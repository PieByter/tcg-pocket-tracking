"use server";

import { and, eq, inArray, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, type Db } from "@/db";
import {
  accounts,
  appConfig,
  cards as cardsTable,
  holdings,
  transfers,
} from "@/db/schema";
import type { Account, Card, Transfer } from "@/db/schema";
import { checkPassword, passwordConfigured, sessionCookieOptions } from "@/lib/auth";
import { defaultTarget } from "@/lib/cards";
import { getSettings } from "@/lib/config";
import { computeUsage } from "@/lib/domain";
import { gameDayKey } from "@/lib/game-day";
import { CONFIG_KEYS, parseSettings } from "@/lib/settings";
import { SESSION_COOKIE, createSessionToken } from "@/lib/session";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type MessageKey } from "@/lib/i18n";
import { buildPlan } from "@/lib/planner";
import { loadLedger } from "@/lib/queries";

export type ActionResult = {
  ok: boolean;
  key: MessageKey;
  params?: Record<string, string | number>;
};
export type LoginState = ActionResult | null;

class ActionError extends Error {
  constructor(
    readonly key: MessageKey,
    readonly params?: Record<string, string | number>,
  ) {
    super(key);
  }
}

const refresh = () => revalidatePath("/", "layout");

function toResult(error: unknown): ActionResult {
  if (error instanceof ActionError) {
    return { ok: false, key: error.key, params: error.params };
  }
  if (error instanceof z.ZodError) {
    return { ok: false, key: "error.invalidInput" };
  }
  console.error(error);
  return { ok: false, key: "error.generic" };
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function numberField(formData: FormData, key: string, fallback: number): number {
  const raw = formData.get(key);
  if (raw === null || raw === "") return fallback;
  return Number(raw);
}

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  if (!passwordConfigured()) {
    return { ok: false, key: "login.notConfigured" };
  }
  const password = String(formData.get("password") ?? "");
  if (!checkPassword(password)) {
    return { ok: false, key: "login.wrongPassword" };
  }
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions);
  redirect("/");
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

export async function changeLocale(formData: FormData): Promise<void> {
  const value = String(formData.get("locale") ?? "");
  const store = await cookies();
  store.set(LOCALE_COOKIE, isLocale(value) ? value : DEFAULT_LOCALE, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    maxAge: 365 * 24 * 60 * 60,
  });
  refresh();
}

export async function saveHoldings(
  edits: { accountId: string; cardId: string; qty: number; targetQty?: number }[],
): Promise<ActionResult> {
  try {
    if (edits.length === 0) return { ok: true, key: "action.holdings.none" };
    const db = await getDb();
    const settings = await getSettings();

    const deduped = new Map<string, { accountId: string; cardId: string; qty: number; targetQty?: number }>();
    for (const edit of edits) {
      const qty = Math.max(0, Math.min(99, Math.trunc(edit.qty)));
      const targetQty =
        edit.targetQty === undefined ? undefined : Math.max(0, Math.min(99, Math.trunc(edit.targetQty)));
      deduped.set(`${edit.accountId}|${edit.cardId}`, { ...edit, qty, targetQty });
    }

    const cardRows = await db
      .select()
      .from(cardsTable)
      .where(inArray(cardsTable.id, [...new Set([...deduped.values()].map((row) => row.cardId))]));
    const cardMap = new Map(cardRows.map((card) => [card.id, card]));

    const values = [...deduped.values()].flatMap((edit) => {
      const card = cardMap.get(edit.cardId);
      if (!card) return [];
      return [
        {
          accountId: edit.accountId,
          cardId: edit.cardId,
          qty: edit.qty,
          targetQty: edit.targetQty ?? defaultTarget(card, settings),
          withTarget: edit.targetQty !== undefined,
        },
      ];
    });

    const withoutTarget = values.filter((value) => !value.withTarget);
    const withTarget = values.filter((value) => value.withTarget);

    if (withoutTarget.length > 0) {
      await db
        .insert(holdings)
        .values(withoutTarget.map((value) => ({
          accountId: value.accountId,
          cardId: value.cardId,
          qty: value.qty,
          targetQty: value.targetQty,
        })))
        .onConflictDoUpdate({
          target: [holdings.accountId, holdings.cardId],
          set: { qty: sql`excluded.qty`, updatedAt: new Date() },
        });
    }

    if (withTarget.length > 0) {
      await db
        .insert(holdings)
        .values(withTarget.map((value) => ({
          accountId: value.accountId,
          cardId: value.cardId,
          qty: value.qty,
          targetQty: value.targetQty,
        })))
        .onConflictDoUpdate({
          target: [holdings.accountId, holdings.cardId],
          set: { qty: sql`excluded.qty`, targetQty: sql`excluded.target_qty`, updatedAt: new Date() },
        });
    }

    refresh();
    return {
      ok: true,
      key: "action.holdings.saved",
      params: { count: values.length },
    };
  } catch (error) {
    return toResult(error);
  }
}

const transferSchema = z.object({
  method: z.enum(["share", "trade"]),
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  cardOutId: z.string().min(1),
  cardInId: z.string().optional(),
  plannedDay: z.string().optional(),
  note: z.string().max(280).optional(),
});

export async function createTransfer(formData: FormData): Promise<ActionResult> {
  try {
    const input = transferSchema.parse({
      method: text(formData, "method"),
      fromAccountId: text(formData, "fromAccountId"),
      toAccountId: text(formData, "toAccountId"),
      cardOutId: text(formData, "cardOutId"),
      cardInId: text(formData, "cardInId") || undefined,
      plannedDay: text(formData, "plannedDay") || undefined,
      note: text(formData, "note") || undefined,
    });

    if (input.fromAccountId === input.toAccountId) {
      throw new ActionError("error.sameAccount");
    }

    const db = await getDb();
    const [card] = await db.select().from(cardsTable).where(eq(cardsTable.id, input.cardOutId));
    if (!card) throw new ActionError("error.cardNotFound");
    if (input.method === "share" && !card.shareable) {
      throw new ActionError("error.shareNotAllowed");
    }
    if (input.method === "trade" && !card.tradable) {
      throw new ActionError("error.tradeNotAllowed");
    }

    let cardIn: Card | undefined;
    if (input.method === "trade") {
      if (!input.cardInId) throw new ActionError("error.tradeNeedsCard");
      [cardIn] = await db.select().from(cardsTable).where(eq(cardsTable.id, input.cardInId));
      if (!cardIn) throw new ActionError("error.tradeBackNotFound");
      if (!cardIn.tradable) throw new ActionError("error.tradeBackNotTradable");
      if (cardIn.rarityCode !== card.rarityCode) {
        throw new ActionError("error.tradeRarityMismatch");
      }
    }

    const duplicate = await db
      .select({ id: transfers.id })
      .from(transfers)
      .where(
        and(
          eq(transfers.status, "planned"),
          eq(transfers.fromAccountId, input.fromAccountId),
          eq(transfers.toAccountId, input.toAccountId),
          eq(transfers.cardOutId, input.cardOutId),
        ),
      )
      .limit(1);
    if (duplicate.length > 0) {
      return { ok: true, key: "action.transfer.duplicate" };
    }

    await db.insert(transfers).values({
      method: input.method,
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      cardOutId: input.cardOutId,
      cardInId: input.method === "trade" ? cardIn?.id ?? null : null,
      plannedDay: input.plannedDay ?? null,
      note: input.note ?? null,
      status: "planned",
    });

    refresh();
    return { ok: true, key: "action.transfer.created" };
  } catch (error) {
    return toResult(error);
  }
}

async function loadTransferForUpdate(tx: Db, id: string): Promise<Transfer> {
  const [row] = await tx.select().from(transfers).where(eq(transfers.id, id)).for("update");
  if (!row) throw new ActionError("error.transferNotFound");
  return row;
}

async function lockAccounts(tx: Db, ids: string[]): Promise<Map<string, Account>> {
  const rows = await tx
    .select()
    .from(accounts)
    .where(inArray(accounts.id, [...new Set(ids)]))
    .for("update");
  return new Map(rows.map((row) => [row.id, row]));
}

async function usageRows(tx: Db, accountIds: string[]) {
  return tx
    .select()
    .from(transfers)
    .where(
      or(
        inArray(transfers.fromAccountId, accountIds),
        inArray(transfers.toAccountId, accountIds),
      ),
    );
}

export async function markTransferSent(formData: FormData): Promise<ActionResult> {
  try {
    const id = text(formData, "id");
    const db = await getDb();
    const settings = await getSettings();
    const today = gameDayKey(new Date(), settings);

    const result: ActionResult = await db.transaction(async (tx): Promise<ActionResult> => {
      const transfer = await loadTransferForUpdate(tx as unknown as Db, id);
      if (transfer.status === "sent") return { ok: true, key: "action.alreadySent" };
      if (transfer.status !== "planned") {
        throw new ActionError("error.onlyPlannedCanSend");
      }

      await lockAccounts(tx as unknown as Db, [transfer.fromAccountId, transfer.toAccountId]);
      const rows = (await usageRows(tx as unknown as Db, [
        transfer.fromAccountId,
        transfer.toAccountId,
      ])) as Transfer[];
      const usage = computeUsage(
        rows.filter((row) => row.id !== transfer.id),
        today,
      );

      if (transfer.method === "share") {
        if ((usage.receivedShare.get(transfer.toAccountId) ?? 0) >= settings.shareReceivePerDay) {
          throw new ActionError("error.receiveQuotaFull", {
            limit: settings.shareReceivePerDay,
          });
        }
        const pairCount =
          usage.sharePairs.get(`${transfer.fromAccountId}|${transfer.toAccountId}`) ?? 0;
        if (pairCount >= settings.shareSendPerPairPerDay) {
          throw new ActionError("error.pairQuotaFull");
        }
      } else {
        if (
          (usage.tradesPerAccount.get(transfer.fromAccountId) ?? 0) >=
            settings.tradePerAccountPerDay ||
          (usage.tradesPerAccount.get(transfer.toAccountId) ?? 0) >=
            settings.tradePerAccountPerDay
        ) {
          throw new ActionError("error.tradeQuotaFull");
        }
        const last =
          usage.lastTradePerPair.get(`${transfer.fromAccountId}|${transfer.toAccountId}`) ??
          usage.lastTradePerPair.get(`${transfer.toAccountId}|${transfer.fromAccountId}`);
        if (last === today && settings.tradePairCooldownDays > 0) {
          throw new ActionError("error.tradePairCooldown");
        }
      }

      await tx
        .update(transfers)
        .set({ status: "sent", gameDay: today, sentAt: new Date(), updatedAt: new Date() })
        .where(and(eq(transfers.id, transfer.id), eq(transfers.status, "planned")));

      return { ok: true, key: "action.sent" };
    });

    refresh();
    return result;
  } catch (error) {
    return toResult(error);
  }
}

export async function confirmTransfer(formData: FormData): Promise<ActionResult> {
  try {
    const id = text(formData, "id");
    const db = await getDb();
    const settings = await getSettings();
    const today = gameDayKey(new Date(), settings);

    const result: ActionResult = await db.transaction(async (tx): Promise<ActionResult> => {
      const transfer = await loadTransferForUpdate(tx as unknown as Db, id);
      if (transfer.status === "confirmed") {
        return { ok: true, key: "action.alreadyConfirmed" };
      }
      if (transfer.status !== "sent") {
        throw new ActionError("error.onlySentCanConfirm");
      }

      await lockAccounts(tx as unknown as Db, [transfer.fromAccountId, transfer.toAccountId]);
      const rows = (await usageRows(tx as unknown as Db, [
        transfer.fromAccountId,
        transfer.toAccountId,
      ])) as Transfer[];
      const usage = computeUsage(
        rows.filter((row) => row.id !== transfer.id),
        today,
      );

      if (transfer.method === "share") {
        if ((usage.receivedShare.get(transfer.toAccountId) ?? 0) >= settings.shareReceivePerDay) {
          throw new ActionError("error.receiveQuotaConflict");
        }
        const pairCount =
          usage.sharePairs.get(`${transfer.fromAccountId}|${transfer.toAccountId}`) ?? 0;
        if (pairCount >= settings.shareSendPerPairPerDay) {
          throw new ActionError("error.pairQuotaConflict");
        }
      } else {
        if (
          (usage.tradesPerAccount.get(transfer.fromAccountId) ?? 0) >=
            settings.tradePerAccountPerDay ||
          (usage.tradesPerAccount.get(transfer.toAccountId) ?? 0) >=
            settings.tradePerAccountPerDay
        ) {
          throw new ActionError("error.tradeQuotaConflict");
        }
        const lastTrade =
          usage.lastTradePerPair.get(`${transfer.fromAccountId}|${transfer.toAccountId}`) ??
          usage.lastTradePerPair.get(`${transfer.toAccountId}|${transfer.fromAccountId}`);
        if (lastTrade === today && settings.tradePairCooldownDays > 0) {
          throw new ActionError("error.tradePairCooldown");
        }
      }

      const claimed = await tx
        .update(transfers)
        .set({
          status: "confirmed",
          gameDay: transfer.gameDay ?? today,
          confirmedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(transfers.id, transfer.id), eq(transfers.status, "sent")))
        .returning({ id: transfers.id });
      if (claimed.length === 0) {
        throw new ActionError("error.transferClaimed");
      }

      const cardRows = await tx
        .select()
        .from(cardsTable)
        .where(
          inArray(
            cardsTable.id,
            [transfer.cardOutId, transfer.cardInId].filter((value): value is string => Boolean(value)),
          ),
        );
      const cardMap = new Map(cardRows.map((card) => [card.id, card]));

      const moveCard = async (
        accountId: string,
        cardId: string,
        delta: 1 | -1,
      ) => {
        const [existing] = await tx
          .select()
          .from(holdings)
          .where(and(eq(holdings.accountId, accountId), eq(holdings.cardId, cardId)))
          .for("update");

        if (!existing) {
          if (delta < 0) throw new ActionError("error.insufficientStock");
          const card = cardMap.get(cardId);
          await tx.insert(holdings).values({
            accountId,
            cardId,
            qty: delta,
            targetQty: card ? defaultTarget(card, settings) : 1,
          });
          return;
        }

        const nextQty = existing.qty + delta;
        if (nextQty < 0) {
          throw new ActionError("error.insufficientStock");
        }
        await tx
          .update(holdings)
          .set({ qty: nextQty, updatedAt: new Date() })
          .where(and(eq(holdings.accountId, accountId), eq(holdings.cardId, cardId)));
      };

      await moveCard(transfer.fromAccountId, transfer.cardOutId, -1);
      await moveCard(transfer.toAccountId, transfer.cardOutId, 1);

      if (transfer.method === "trade" && transfer.cardInId) {
        await moveCard(transfer.toAccountId, transfer.cardInId, -1);
        await moveCard(transfer.fromAccountId, transfer.cardInId, 1);
      }

      return { ok: true, key: "action.confirmed" };
    });

    refresh();
    return result;
  } catch (error) {
    return toResult(error);
  }
}

export async function cancelTransfer(formData: FormData): Promise<ActionResult> {
  try {
    const id = text(formData, "id");
    const db = await getDb();
    const updated = await db
      .update(transfers)
      .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
      .where(and(eq(transfers.id, id), inArray(transfers.status, ["planned", "sent"])))
      .returning({ id: transfers.id });
    if (updated.length === 0) {
      throw new ActionError("error.cannotCancel");
    }
    refresh();
    return { ok: true, key: "action.cancelled" };
  } catch (error) {
    return toResult(error);
  }
}

const accountSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(60),
  friendCode: z.string().max(30).optional(),
  minEx: z.number().int().min(0).max(20),
  notes: z.string().max(280).optional(),
  tradeStamina: z.number().int().min(0).max(99).optional(),
  shinedust: z.number().int().min(0).max(9_999_999).optional(),
});

export async function saveAccount(formData: FormData): Promise<ActionResult> {
  try {
    const rawId = text(formData, "id");
    const input = accountSchema.parse({
      id: rawId || undefined,
      name: text(formData, "name"),
      friendCode: text(formData, "friendCode") || undefined,
      minEx: Math.trunc(numberField(formData, "minEx", 2)),
      notes: text(formData, "notes") || undefined,
      tradeStamina:
        formData.get("tradeStamina") === null
          ? undefined
          : Math.trunc(numberField(formData, "tradeStamina", 0)),
      shinedust:
        formData.get("shinedust") === null
          ? undefined
          : Math.trunc(numberField(formData, "shinedust", 0)),
    });

    const db = await getDb();
    if (input.id) {
      const [existing] = await db.select().from(accounts).where(eq(accounts.id, input.id));
      if (!existing) throw new ActionError("error.accountNotFound");

      const stamina = input.tradeStamina ?? existing.tradeStamina;
      const dust = input.shinedust ?? existing.shinedust;
      const resourcesChanged =
        stamina !== existing.tradeStamina || dust !== existing.shinedust;

      await db
        .update(accounts)
        .set({
          name: input.name,
          friendCode: input.friendCode ?? null,
          minEx: input.minEx,
          notes: input.notes ?? null,
          tradeStamina: stamina,
          shinedust: dust,
          resourcesUpdatedAt: resourcesChanged ? new Date() : existing.resourcesUpdatedAt,
        })
        .where(eq(accounts.id, input.id));
    } else {
      const existing = await db.select({ id: accounts.id }).from(accounts);
      await db.insert(accounts).values({
        name: input.name,
        friendCode: input.friendCode ?? null,
        minEx: input.minEx,
        notes: input.notes ?? null,
        tradeStamina: input.tradeStamina ?? 0,
        shinedust: input.shinedust ?? 0,
        sortOrder: existing.length,
      });
    }

    refresh();
    return { ok: true, key: "action.account.saved" };
  } catch (error) {
    return toResult(error);
  }
}

export async function saveResources(formData: FormData): Promise<ActionResult> {
  try {
    const accountId = text(formData, "accountId");
    if (!accountId) throw new ActionError("error.accountNotFound");

    const stamina = Math.max(0, Math.min(99, Math.trunc(numberField(formData, "stamina", 0))));
    const shinedust = Math.max(
      0,
      Math.min(9_999_999, Math.trunc(numberField(formData, "shinedust", 0))),
    );

    const db = await getDb();
    const updated = await db
      .update(accounts)
      .set({ tradeStamina: stamina, shinedust, resourcesUpdatedAt: new Date() })
      .where(eq(accounts.id, accountId))
      .returning({ id: accounts.id });
    if (updated.length === 0) throw new ActionError("error.accountNotFound");

    refresh();
    return { ok: true, key: "action.resources.saved" };
  } catch (error) {
    return toResult(error);
  }
}

export async function applyPlan(formData: FormData): Promise<ActionResult> {
  try {
    const days = Math.max(0, Math.trunc(numberField(formData, "days", 0)));
    const ledger = await loadLedger();
    const plan = buildPlan({
      accounts: ledger.accounts,
      cards: ledger.cards,
      holdings: ledger.holdings,
      settings: ledger.settings,
      today: ledger.today,
      transfers: ledger.transfers,
      now: new Date(),
    });

    const slots = days > 0 ? plan.slots.filter((slot) => slot.dayIndex < days) : plan.slots;
    if (slots.length === 0) return { ok: true, key: "action.plan.none" };

    const existing = new Set(
      ledger.transfers
        .filter((transfer) => transfer.status === "planned")
        .map(
          (transfer) =>
            `${transfer.fromAccountId}|${transfer.toAccountId}|${transfer.cardOutId}|${transfer.plannedDay ?? ""}`,
        ),
    );

    const values = slots.flatMap((slot) => {
      const key = `${slot.from.id}|${slot.to.id}|${slot.card.id}|${slot.day}`;
      if (existing.has(key)) return [];
      existing.add(key);
      return [
        {
          method: slot.method,
          fromAccountId: slot.from.id,
          toAccountId: slot.to.id,
          cardOutId: slot.card.id,
          cardInId: slot.method === "trade" ? slot.tradeBack?.id ?? null : null,
          plannedDay: slot.day,
          status: "planned" as const,
        },
      ];
    });

    if (values.length === 0) return { ok: true, key: "action.plan.none" };

    const db = await getDb();
    await db.insert(transfers).values(values);
    refresh();
    return { ok: true, key: "action.plan.applied", params: { count: values.length } };
  } catch (error) {
    return toResult(error);
  }
}

export async function deleteAccount(formData: FormData): Promise<ActionResult> {
  try {
    const id = text(formData, "id");
    const db = await getDb();
    const used = await db
      .select({ id: transfers.id })
      .from(transfers)
      .where(or(eq(transfers.fromAccountId, id), eq(transfers.toAccountId, id)))
      .limit(1);
    if (used.length > 0) {
      throw new ActionError("error.accountHasHistory");
    }
    await db.delete(accounts).where(eq(accounts.id, id));
    refresh();
    return { ok: true, key: "action.account.deleted" };
  } catch (error) {
    return toResult(error);
  }
}

export async function saveSettings(formData: FormData): Promise<ActionResult> {
  try {
    const db = await getDb();
    const current = await db.select().from(appConfig);
    const settings = parseSettings(current);

    const next = {
      ...settings,
      shareReceivePerDay: clamp(numberField(formData, "shareReceivePerDay", settings.shareReceivePerDay), 1, 5),
      shareSendPerPairPerDay: clamp(
        numberField(formData, "shareSendPerPairPerDay", settings.shareSendPerPairPerDay),
        1,
        5,
      ),
      tradePerAccountPerDay: clamp(
        numberField(formData, "tradePerAccountPerDay", settings.tradePerAccountPerDay),
        1,
        20,
      ),
      tradePairCooldownDays: clamp(
        numberField(formData, "tradePairCooldownDays", settings.tradePairCooldownDays),
        0,
        30,
      ),
      resetHour: clamp(numberField(formData, "resetHour", settings.resetHour), 0, 23),
      timeZone: text(formData, "timeZone") || settings.timeZone,
      trainerTarget: clamp(numberField(formData, "trainerTarget", settings.trainerTarget), 0, 10),
      exTarget: clamp(numberField(formData, "exTarget", settings.exTarget), 0, 10),
      exCountMode: text(formData, "exCountMode") === "print" ? ("print" as const) : ("name" as const),
      plannerHorizonDays: clamp(
        numberField(formData, "plannerHorizonDays", settings.plannerHorizonDays),
        1,
        60,
      ),
      tradeStaminaRegenHours: clamp(
        numberField(formData, "tradeStaminaRegenHours", settings.tradeStaminaRegenHours),
        1,
        168,
      ),
      maxTradeStamina: clamp(
        numberField(formData, "maxTradeStamina", settings.maxTradeStamina),
        1,
        99,
      ),
    };

    for (const [field, value] of Object.entries(next) as [keyof typeof next, unknown][]) {
      if (field === "tradeCosts") continue;
      await db
        .insert(appConfig)
        .values({ key: CONFIG_KEYS[field], value: JSON.stringify(value) })
        .onConflictDoUpdate({
          target: appConfig.key,
          set: { value: JSON.stringify(value), updatedAt: new Date() },
        });
    }

    refresh();
    return { ok: true, key: "action.settings.saved" };
  } catch (error) {
    return toResult(error);
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
