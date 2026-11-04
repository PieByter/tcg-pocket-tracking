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

export type ActionResult = { ok: boolean; message: string };
export type LoginState = ActionResult | null;

class ActionError extends Error {}

const refresh = () => revalidatePath("/", "layout");

function toResult(error: unknown): ActionResult {
  if (error instanceof ActionError) return { ok: false, message: error.message };
  if (error instanceof z.ZodError) {
    return { ok: false, message: error.issues[0]?.message ?? "Input tidak valid." };
  }
  console.error(error);
  const message = error instanceof Error ? error.message : "Terjadi kesalahan.";
  return { ok: false, message };
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
    return { ok: false, message: "APP_PASSWORD belum diset di environment." };
  }
  const password = String(formData.get("password") ?? "");
  if (!checkPassword(password)) {
    return { ok: false, message: "Password salah." };
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

export async function saveHoldings(
  edits: { accountId: string; cardId: string; qty: number; targetQty?: number }[],
): Promise<ActionResult> {
  try {
    if (edits.length === 0) return { ok: true, message: "Tidak ada perubahan." };
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
    return { ok: true, message: `${values.length} kartu diperbarui.` };
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
      throw new ActionError("Akun pemberi dan penerima harus berbeda.");
    }

    const db = await getDb();
    const [card] = await db.select().from(cardsTable).where(eq(cardsTable.id, input.cardOutId));
    if (!card) throw new ActionError("Kartu tidak ditemukan.");
    if (input.method === "share" && !card.shareable) {
      throw new ActionError("Kartu ini tidak bisa di-Share.");
    }
    if (input.method === "trade" && !card.tradable) {
      throw new ActionError("Kartu ini tidak bisa di-Trade.");
    }

    let cardIn: Card | undefined;
    if (input.method === "trade") {
      if (!input.cardInId) throw new ActionError("Trade butuh kartu pengganti.");
      [cardIn] = await db.select().from(cardsTable).where(eq(cardsTable.id, input.cardInId));
      if (!cardIn) throw new ActionError("Kartu pengganti tidak ditemukan.");
      if (!cardIn.tradable) throw new ActionError("Kartu pengganti tidak bisa di-Trade.");
      if (cardIn.rarityCode !== card.rarityCode) {
        throw new ActionError("Trade harus sepadan rarity.");
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
      return { ok: true, message: "Rencana serupa sudah ada." };
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
    return { ok: true, message: "Rencana transfer dibuat." };
  } catch (error) {
    return toResult(error);
  }
}

async function loadTransferForUpdate(tx: Db, id: string): Promise<Transfer> {
  const [row] = await tx.select().from(transfers).where(eq(transfers.id, id)).for("update");
  if (!row) throw new ActionError("Transfer tidak ditemukan.");
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

    const result = await db.transaction(async (tx) => {
      const transfer = await loadTransferForUpdate(tx as unknown as Db, id);
      if (transfer.status === "sent") return { ok: true, message: "Sudah ditandai terkirim." };
      if (transfer.status !== "planned") {
        throw new ActionError("Hanya rencana yang bisa ditandai terkirim.");
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
          throw new ActionError(
            `Kuota terima ${settings.shareReceivePerDay} kartu/hari untuk akun penerima sudah habis.`,
          );
        }
        const pairCount =
          usage.sharePairs.get(`${transfer.fromAccountId}|${transfer.toAccountId}`) ?? 0;
        if (pairCount >= settings.shareSendPerPairPerDay) {
          throw new ActionError("Kuota kirim ke akun ini untuk hari ini sudah habis.");
        }
      } else {
        if (
          (usage.tradesPerAccount.get(transfer.fromAccountId) ?? 0) >=
            settings.tradePerAccountPerDay ||
          (usage.tradesPerAccount.get(transfer.toAccountId) ?? 0) >=
            settings.tradePerAccountPerDay
        ) {
          throw new ActionError("Kuota trade harian akun ini sudah habis.");
        }
        const last =
          usage.lastTradePerPair.get(`${transfer.fromAccountId}|${transfer.toAccountId}`) ??
          usage.lastTradePerPair.get(`${transfer.toAccountId}|${transfer.fromAccountId}`);
        if (last === today && settings.tradePairCooldownDays > 0) {
          throw new ActionError("Pasangan akun ini sedang cooldown trade.");
        }
      }

      await tx
        .update(transfers)
        .set({ status: "sent", gameDay: today, sentAt: new Date(), updatedAt: new Date() })
        .where(and(eq(transfers.id, transfer.id), eq(transfers.status, "planned")));

      return { ok: true, message: "Ditandai terkirim. Konfirmasi setelah diterima di game." };
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

    const result = await db.transaction(async (tx) => {
      const transfer = await loadTransferForUpdate(tx as unknown as Db, id);
      if (transfer.status === "confirmed") {
        return { ok: true, message: "Transfer sudah dikonfirmasi sebelumnya." };
      }
      if (transfer.status !== "sent") {
        throw new ActionError("Tandai terkirim dulu sebelum konfirmasi.");
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
          throw new ActionError("Batas penerimaan harian akun ini sudah terpakai transfer lain.");
        }
        const pairCount =
          usage.sharePairs.get(`${transfer.fromAccountId}|${transfer.toAccountId}`) ?? 0;
        if (pairCount >= settings.shareSendPerPairPerDay) {
          throw new ActionError("Batas kirim harian pasangan akun ini sudah terpakai.");
        }
      } else {
        if (
          (usage.tradesPerAccount.get(transfer.fromAccountId) ?? 0) >=
            settings.tradePerAccountPerDay ||
          (usage.tradesPerAccount.get(transfer.toAccountId) ?? 0) >=
            settings.tradePerAccountPerDay
        ) {
          throw new ActionError("Batas trade harian akun ini sudah terpakai transfer lain.");
        }
        const lastTrade =
          usage.lastTradePerPair.get(`${transfer.fromAccountId}|${transfer.toAccountId}`) ??
          usage.lastTradePerPair.get(`${transfer.toAccountId}|${transfer.fromAccountId}`);
        if (lastTrade === today && settings.tradePairCooldownDays > 0) {
          throw new ActionError("Pasangan akun ini masih dalam cooldown trade.");
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
        throw new ActionError("Transfer sudah diproses oleh permintaan lain.");
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
          if (delta < 0) throw new ActionError("Stok kartu tidak cukup untuk transfer ini.");
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
          throw new ActionError("Stok kartu tidak cukup untuk transfer ini.");
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

      return { ok: true, message: "Transfer dikonfirmasi. Kepemilikan diperbarui." };
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
      throw new ActionError("Transfer tidak bisa dibatalkan.");
    }
    refresh();
    return { ok: true, message: "Transfer dibatalkan." };
  } catch (error) {
    return toResult(error);
  }
}

const accountSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Nama akun wajib diisi.").max(60),
  friendCode: z.string().max(30).optional(),
  minEx: z.number().int().min(0).max(20),
  notes: z.string().max(280).optional(),
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
    });

    const db = await getDb();
    if (input.id) {
      await db
        .update(accounts)
        .set({
          name: input.name,
          friendCode: input.friendCode ?? null,
          minEx: input.minEx,
          notes: input.notes ?? null,
        })
        .where(eq(accounts.id, input.id));
    } else {
      const existing = await db.select({ id: accounts.id }).from(accounts);
      await db.insert(accounts).values({
        name: input.name,
        friendCode: input.friendCode ?? null,
        minEx: input.minEx,
        notes: input.notes ?? null,
        sortOrder: existing.length,
      });
    }

    refresh();
    return { ok: true, message: "Akun disimpan." };
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
      throw new ActionError("Akun masih dipakai di riwayat transfer. Batalkan/arsipkan dulu.");
    }
    await db.delete(accounts).where(eq(accounts.id, id));
    refresh();
    return { ok: true, message: "Akun dihapus." };
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
    return { ok: true, message: "Aturan disimpan." };
  } catch (error) {
    return toResult(error);
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
