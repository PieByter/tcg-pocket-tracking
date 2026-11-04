import type { Account, Card } from "@/db/schema";
import { exIdentity, tradeCost, transferMethod } from "./cards";
import type { AppSettings } from "./settings";
import { type CardMap, type HoldingsByAccount, type UsageTransfer, computeUsage, daysBetween, pairKey } from "./domain";
import { shiftDay } from "./game-day";

export type PlanReason = "ex" | "trainer";

export type PlanSlot = {
  day: string;
  dayIndex: number;
  card: Card;
  from: Account;
  to: Account;
  method: "share" | "trade";
  tradeBack: Card | null;
  cost: number;
  reason: PlanReason;
};

export type PlanRemaining = { account: Account; exDeficit: number; trainerDeficit: number };

export type PlannerResult = {
  slots: PlanSlot[];
  remaining: PlanRemaining[];
  daysUsed: number;
  totalSlots: number;
  feasible: boolean;
};

type SimCard = { qty: number; target: number };
type Sim = Map<string, Map<string, SimCard>>;

export type PlannerTransfer = UsageTransfer & {
  cardOutId?: string;
  cardInId?: string | null;
  plannedDay?: string | null;
};

export type PlannerInput = {
  accounts: Account[];
  cards: CardMap;
  holdings: HoldingsByAccount;
  settings: AppSettings;
  today: string;
  horizonDays?: number;
  /** Transfer sent/confirmed (kuota terpakai) dan planned (komitmen). */
  transfers?: PlannerTransfer[];
};

function cloneSim(holdings: HoldingsByAccount): Sim {
  const sim: Sim = new Map();
  for (const account of holdings.keys()) {
    const own = new Map<string, SimCard>();
    for (const [cardId, state] of holdings.get(account)!) {
      own.set(cardId, { qty: state.qty, target: state.targetQty });
    }
    sim.set(account, own);
  }
  return sim;
}

function qtyOf(sim: Sim, accountId: string, cardId: string): number {
  return sim.get(accountId)?.get(cardId)?.qty ?? 0;
}

function targetOf(sim: Sim, accountId: string, cardId: string, fallback: number): number {
  return sim.get(accountId)?.get(cardId)?.target ?? fallback;
}

function setQty(sim: Sim, accountId: string, cardId: string, qty: number, target: number) {
  let own = sim.get(accountId);
  if (!own) {
    own = new Map();
    sim.set(accountId, own);
  }
  const existing = own.get(cardId);
  own.set(cardId, { qty: Math.max(0, qty), target: existing?.target ?? target });
}

function exUniques(sim: Sim, accountId: string, cards: CardMap, mode: AppSettings["exCountMode"]) {
  const identities = new Map<string, number>();
  for (const [cardId, state] of sim.get(accountId) ?? []) {
    const card = cards.get(cardId);
    if (!card || card.kind !== "ex" || state.qty <= 0) continue;
    const key = exIdentity(card, mode);
    identities.set(key, (identities.get(key) ?? 0) + state.qty);
  }
  return identities;
}

function canDonate(
  sim: Sim,
  donor: Account,
  card: Card,
  cards: CardMap,
  settings: AppSettings,
  requireSpare: boolean,
): boolean {
  const target = targetOf(sim, donor.id, card.id, fallbackTarget(card, settings));
  const qty = qtyOf(sim, donor.id, card.id);
  const spare = qty - target;
  if (requireSpare) return spare > 0;
  if (spare > 0) return true;
  if (card.kind !== "ex") return false;
  const identities = exUniques(sim, donor.id, cards, settings.exCountMode);
  const key = exIdentity(card, settings.exCountMode);
  const remaining = (identities.get(key) ?? 0) - 1;
  const uniqueAfter = identities.size - (remaining > 0 ? 0 : 1);
  return uniqueAfter >= donor.minEx;
}

function fallbackTarget(card: Card, settings: AppSettings): number {
  if (card.kind === "ex") return settings.exTarget;
  if (card.kind === "trainer") return settings.trainerTarget;
  return 1;
}

type DayBook = {
  receive: Map<string, number>;
  sharePairs: Map<string, number>;
  trades: Map<string, number>;
};

export function buildPlan(input: PlannerInput): PlannerResult {
  const { accounts, cards, settings, today } = input;
  const horizon = input.horizonDays ?? settings.plannerHorizonDays;
  const sim = cloneSim(input.holdings);
  const lastTradePair = new Map<string, string>();
  const usageTransfers = input.transfers ?? [];

  for (const transfer of usageTransfers) {
    if (transfer.method !== "trade" || !transfer.gameDay) continue;
    if (transfer.status !== "sent" && transfer.status !== "confirmed") continue;
    const key = pairKey(transfer.fromAccountId, transfer.toAccountId);
    const previous = lastTradePair.get(key);
    if (!previous || previous < transfer.gameDay) lastTradePair.set(key, transfer.gameDay);
  }

  const books = new Map<string, DayBook>();
  const bookFor = (day: string): DayBook => {
    let book = books.get(day);
    if (!book) {
      book = { receive: new Map(), sharePairs: new Map(), trades: new Map() };
      books.set(day, book);
    }
    return book;
  };

  // Kuota yang sudah terpakai hari ini harus dihormati oleh jadwal hari pertama.
  const todayUsage = computeUsage(usageTransfers, today);
  const todayBook = bookFor(today);
  for (const [accountId, count] of todayUsage.receivedShare) todayBook.receive.set(accountId, count);
  for (const [pair, count] of todayUsage.sharePairs) todayBook.sharePairs.set(pair, count);
  for (const [accountId, count] of todayUsage.tradesPerAccount) todayBook.trades.set(accountId, count);

  const slots: PlanSlot[] = [];
  const bump = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);

  // Transfer "planned" adalah komitmen: kartu dianggap akan berpindah dan
  // slot kuotanya direservasi supaya planner tidak menjadwalkannya dua kali.
  for (const transfer of usageTransfers) {
    if (transfer.status !== "planned" || !transfer.cardOutId) continue;
    const day = transfer.plannedDay && transfer.plannedDay > today ? transfer.plannedDay : today;
    const book = bookFor(day);

    const card = cards.get(transfer.cardOutId);
    if (card) {
      setQty(
        sim,
        transfer.fromAccountId,
        card.id,
        qtyOf(sim, transfer.fromAccountId, card.id) - 1,
        fallbackTarget(card, settings),
      );
      setQty(
        sim,
        transfer.toAccountId,
        card.id,
        qtyOf(sim, transfer.toAccountId, card.id) + 1,
        fallbackTarget(card, settings),
      );
    }

    if (transfer.method === "share") {
      bump(book.receive, transfer.toAccountId);
      bump(book.sharePairs, pairKey(transfer.fromAccountId, transfer.toAccountId));
    } else {
      bump(book.trades, transfer.fromAccountId);
      bump(book.trades, transfer.toAccountId);
      lastTradePair.set(pairKey(transfer.fromAccountId, transfer.toAccountId), day);

      const cardIn = transfer.cardInId ? cards.get(transfer.cardInId) : undefined;
      if (cardIn) {
        setQty(
          sim,
          transfer.toAccountId,
          cardIn.id,
          qtyOf(sim, transfer.toAccountId, cardIn.id) - 1,
          fallbackTarget(cardIn, settings),
        );
        setQty(
          sim,
          transfer.fromAccountId,
          cardIn.id,
          qtyOf(sim, transfer.fromAccountId, cardIn.id) + 1,
          fallbackTarget(cardIn, settings),
        );
      }
    }
  }

  const receiveFree = (day: string, accountId: string) =>
    (bookFor(day).receive.get(accountId) ?? 0) < settings.shareReceivePerDay;
  const sharePairFree = (day: string, from: string, to: string) =>
    (bookFor(day).sharePairs.get(pairKey(from, to)) ?? 0) < settings.shareSendPerPairPerDay;
  const tradeFree = (day: string, accountId: string) =>
    (bookFor(day).trades.get(accountId) ?? 0) < settings.tradePerAccountPerDay;
  const tradePairFree = (day: string, from: string, to: string) => {
    const last = lastTradePair.get(pairKey(from, to)) ?? lastTradePair.get(pairKey(to, from));
    return last === undefined || daysBetween(last, day) >= settings.tradePairCooldownDays;
  };

  const tradeBackFor = (receiverId: string, card: Card): Card | null => {
    let best: { card: Card; qty: number } | null = null;
    for (const [cardId, state] of sim.get(receiverId) ?? []) {
      const candidate = cards.get(cardId);
      if (!candidate || !candidate.tradable) continue;
      if (candidate.rarityCode !== card.rarityCode) continue;
      if (state.qty <= state.target) continue;
      if (!best || state.qty > best.qty) best = { card: candidate, qty: state.qty };
    }
    return best?.card ?? null;
  };

  const commit = (
    day: string,
    dayIndex: number,
    from: Account,
    to: Account,
    card: Card,
    method: "share" | "trade",
    tradeBack: Card | null,
    reason: PlanReason,
  ) => {
    const book = bookFor(day);

    setQty(sim, from.id, card.id, qtyOf(sim, from.id, card.id) - 1, fallbackTarget(card, settings));
    setQty(sim, to.id, card.id, qtyOf(sim, to.id, card.id) + 1, fallbackTarget(card, settings));

    if (method === "share") {
      bump(book.receive, to.id);
      bump(book.sharePairs, pairKey(from.id, to.id));
    } else {
      bump(book.trades, from.id);
      bump(book.trades, to.id);
      if (tradeBack) {
        setQty(sim, to.id, tradeBack.id, qtyOf(sim, to.id, tradeBack.id) - 1, fallbackTarget(tradeBack, settings));
        setQty(sim, from.id, tradeBack.id, qtyOf(sim, from.id, tradeBack.id) + 1, fallbackTarget(tradeBack, settings));
      }
      lastTradePair.set(pairKey(from.id, to.id), day);
    }

    slots.push({
      day,
      dayIndex,
      card,
      from,
      to,
      method,
      tradeBack,
      cost: method === "trade" ? tradeCost(card, settings.tradeCosts) : 0,
      reason,
    });
  };

  const tryDonate = (
    day: string,
    dayIndex: number,
    receiver: Account,
    card: Card,
    reason: PlanReason,
    requireSpare: boolean,
  ): boolean => {
    const method = transferMethod(card);
    if (!method) return false;
    if (method === "share" && !receiveFree(day, receiver.id)) return false;

    const donors = accounts
      .filter((account) => account.id !== receiver.id)
      .filter((account) => qtyOf(sim, account.id, card.id) > 0)
      .filter((account) => canDonate(sim, account, card, cards, settings, requireSpare))
      .filter((account) =>
        method === "share"
          ? sharePairFree(day, account.id, receiver.id)
          : tradeFree(day, account.id) &&
            tradeFree(day, receiver.id) &&
            tradePairFree(day, account.id, receiver.id),
      )
      .sort((a, b) => {
        const spareA = qtyOf(sim, a.id, card.id) - targetOf(sim, a.id, card.id, fallbackTarget(card, settings));
        const spareB = qtyOf(sim, b.id, card.id) - targetOf(sim, b.id, card.id, fallbackTarget(card, settings));
        return spareB - spareA || b.id.localeCompare(a.id);
      });

    for (const donor of donors) {
      const tradeBack = method === "trade" ? tradeBackFor(receiver.id, card) : null;
      if (method === "trade" && !tradeBack) continue;
      commit(day, dayIndex, donor, receiver, card, method, tradeBack, reason);
      return true;
    }
    return false;
  };

  const trainerNeeds = () => {
    const needs: { account: Account; card: Card; missing: number }[] = [];
    for (const account of accounts) {
      for (const [cardId, state] of sim.get(account.id) ?? []) {
        const card = cards.get(cardId);
        if (!card || card.kind !== "trainer") continue;
        if (state.qty >= state.target) continue;
        needs.push({ account, card, missing: state.target - state.qty });
      }
    }
    return needs.sort(
      (a, b) =>
        a.card.rarityScore - b.card.rarityScore ||
        a.card.name.localeCompare(b.card.name) ||
        b.missing - a.missing,
    );
  };

  const exDeficit = (account: Account) => {
    // Akun tanpa catatan holdings tidak dianggap defisit; datanya belum ada.
    if ((sim.get(account.id)?.size ?? 0) === 0) return 0;
    return Math.max(0, account.minEx - exUniques(sim, account.id, cards, settings.exCountMode).size);
  };

  for (let dayIndex = 0; dayIndex < horizon; dayIndex += 1) {
    const day = shiftDay(today, dayIndex);

    // 1. Defisit ex lebih dulu, akun dengan kekurangan terbesar didahulukan.
    // Akun yang koleksinya belum dicatat tidak dijadwalkan (bukan berarti defisit).
    const exTargets = [...accounts]
      .filter((account) => (sim.get(account.id)?.size ?? 0) > 0)
      .sort((a, b) => exDeficit(b) - exDeficit(a) || a.name.localeCompare(b.name));

    for (const receiver of exTargets) {
      let guard = 0;
      while (exDeficit(receiver) > 0 && receiveFree(day, receiver.id) && guard < 20) {
        guard += 1;
        const ownedIdentities = new Set(
          [...exUniques(sim, receiver.id, cards, settings.exCountMode).keys()],
        );
        const options: { card: Card; donorSpare: number }[] = [];
        for (const donor of accounts) {
          if (donor.id === receiver.id) continue;
          for (const [cardId, state] of sim.get(donor.id) ?? []) {
            const card = cards.get(cardId);
            if (!card || card.kind !== "ex" || state.qty <= 0) continue;
            if (qtyOf(sim, receiver.id, cardId) > 0) continue;
            if (ownedIdentities.has(exIdentity(card, settings.exCountMode))) continue;
            if (!transferMethod(card)) continue;
            options.push({
              card,
              donorSpare: state.qty - state.target,
            });
          }
        }
        options.sort(
          (a, b) => b.donorSpare - a.donorSpare || a.card.rarityScore - b.card.rarityScore,
        );

        let placed = false;
        for (const option of options) {
          if (tryDonate(day, dayIndex, receiver, option.card, "ex", false)) {
            placed = true;
            break;
          }
        }
        if (!placed) break;
      }
    }

    // 2. Trainer yang masih di bawah target.
    for (const need of trainerNeeds()) {
      if (!receiveFree(day, need.account.id)) continue;
      tryDonate(day, dayIndex, need.account, need.card, "trainer", false);
    }
  }

  const remaining: PlanRemaining[] = (() => {
    const needs = trainerNeeds();
    return accounts.map((account) => ({
      account,
      exDeficit: exDeficit(account),
      trainerDeficit: needs
        .filter((need) => need.account.id === account.id)
        .reduce((total, need) => total + need.missing, 0),
    }));
  })();

  const daysUsed = slots.reduce((max, slot) => Math.max(max, slot.dayIndex + 1), 0);

  return {
    slots,
    remaining,
    daysUsed,
    totalSlots: slots.length,
    feasible: remaining.every((item) => item.exDeficit === 0 && item.trainerDeficit === 0),
  };
}

export function planSummaryByDay(result: PlannerResult) {
  const days = new Map<string, PlanSlot[]>();
  for (const slot of result.slots) {
    const list = days.get(slot.day) ?? [];
    list.push(slot);
    days.set(slot.day, list);
  }
  return days;
}
