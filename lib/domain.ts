import type { Account, Card, Holding, Transfer } from "@/db/schema";
import type { AppSettings } from "./settings";
import { exIdentity, transferMethod, tradeCost } from "./cards";
import { estimateResources } from "./resources";

export type HoldingState = { qty: number; targetQty: number };
export type HoldingsByAccount = Map<string, Map<string, HoldingState>>;
export type CardMap = Map<string, Card>;

export function buildHoldings(rows: Holding[]): HoldingsByAccount {
  const map: HoldingsByAccount = new Map();
  for (const row of rows) {
    let account = map.get(row.accountId);
    if (!account) {
      account = new Map();
      map.set(row.accountId, account);
    }
    account.set(row.cardId, { qty: row.qty, targetQty: row.targetQty });
  }
  return map;
}

export function buildCards(rows: Card[]): CardMap {
  return new Map(rows.map((card) => [card.id, card]));
}

export function holdingOf(
  holdings: HoldingsByAccount,
  accountId: string,
  cardId: string,
): HoldingState {
  return holdings.get(accountId)?.get(cardId) ?? { qty: 0, targetQty: 0 };
}

function exGroups(
  accountId: string,
  cards: CardMap,
  holdings: HoldingsByAccount,
  mode: AppSettings["exCountMode"],
) {
  const copies = new Map<string, number>();
  const owned = holdings.get(accountId);
  if (!owned) return { unique: 0, copies };
  for (const [cardId, state] of owned) {
    if (state.qty <= 0) continue;
    const card = cards.get(cardId);
    if (!card || card.kind !== "ex") continue;
    const key = exIdentity(card, mode);
    copies.set(key, (copies.get(key) ?? 0) + state.qty);
  }
  return { unique: copies.size, copies };
}

export type AccountSummary = {
  account: Account;
  exCount: number;
  exDeficit: number;
  trainerDeficit: number;
  surplus: number;
  status: "ready" | "needs" | "critical" | "untracked";
  needs: { card: Card; need: number }[];
  spare: { card: Card; spare: number }[];
};

export function summarizeAccount(
  account: Account,
  cards: CardMap,
  holdings: HoldingsByAccount,
  settings: AppSettings,
): AccountSummary {
  const { unique } = exGroups(account.id, cards, holdings, settings.exCountMode);
  const owned = holdings.get(account.id) ?? new Map<string, HoldingState>();
  let trainerDeficit = 0;
  let surplus = 0;
  const needs: { card: Card; need: number }[] = [];
  const spare: { card: Card; spare: number }[] = [];

  for (const [cardId, state] of owned) {
    const card = cards.get(cardId);
    if (!card) continue;
    const target = state.targetQty;
    if (state.qty < target) {
      const need = target - state.qty;
      if (card.kind === "trainer") trainerDeficit += need;
      needs.push({ card, need });
    } else if (state.qty > target) {
      const extra = state.qty - target;
      surplus += extra;
      if (card.kind !== "other") spare.push({ card, spare: extra });
    }
  }

  needs.sort((a, b) => a.card.rarityScore - b.card.rarityScore || a.card.name.localeCompare(b.card.name));
  spare.sort((a, b) => b.spare - a.spare || a.card.name.localeCompare(b.card.name));

  const exDeficit = Math.max(0, account.minEx - unique);
  return {
    account,
    exCount: unique,
    exDeficit,
    trainerDeficit,
    surplus,
    status:
      owned.size === 0 ? "untracked" : unique === 0 ? "critical" : exDeficit > 0 ? "needs" : "ready",
    needs,
    spare,
  };
}

export function summarizeAccounts(
  accounts: Account[],
  cards: CardMap,
  holdings: HoldingsByAccount,
  settings: AppSettings,
): AccountSummary[] {
  return accounts.map((account) => summarizeAccount(account, cards, holdings, settings));
}

export type DayUsage = {
  gameDay: string;
  receivedShare: Map<string, number>;
  sharePairs: Map<string, number>;
  tradesPerAccount: Map<string, number>;
  lastTradePerPair: Map<string, string>;
};

export const pairKey = (from: string, to: string) => `${from}|${to}`;

export type UsageTransfer = Pick<
  Transfer,
  "method" | "fromAccountId" | "toAccountId" | "gameDay" | "status"
>;

export function computeUsage(
  transfers: UsageTransfer[],
  gameDay: string,
): DayUsage {
  const usage: DayUsage = {
    gameDay,
    receivedShare: new Map(),
    sharePairs: new Map(),
    tradesPerAccount: new Map(),
    lastTradePerPair: new Map(),
  };

  for (const transfer of transfers) {
    if (transfer.status !== "sent" && transfer.status !== "confirmed") continue;
    const day = transfer.gameDay;
    if (!day) continue;

    if (transfer.method === "trade") {
      const previous = usage.lastTradePerPair.get(pairKey(transfer.fromAccountId, transfer.toAccountId));
      if (!previous || previous < day) {
        usage.lastTradePerPair.set(pairKey(transfer.fromAccountId, transfer.toAccountId), day);
      }
      if (day === gameDay) {
        for (const accountId of [transfer.fromAccountId, transfer.toAccountId]) {
          usage.tradesPerAccount.set(accountId, (usage.tradesPerAccount.get(accountId) ?? 0) + 1);
        }
      }
      continue;
    }

    if (day !== gameDay) continue;
    usage.receivedShare.set(
      transfer.toAccountId,
      (usage.receivedShare.get(transfer.toAccountId) ?? 0) + 1,
    );
    const key = pairKey(transfer.fromAccountId, transfer.toAccountId);
    usage.sharePairs.set(key, (usage.sharePairs.get(key) ?? 0) + 1);
  }

  return usage;
}

export function daysBetween(fromDay: string, toDay: string): number {
  const from = Date.parse(`${fromDay}T00:00:00Z`);
  const to = Date.parse(`${toDay}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

export type Quota = {
  receiveRemaining: number;
  pairSendRemaining: number;
  tradeFromRemaining: number;
  tradeToRemaining: number;
  tradePairBlocked: boolean;
};

export function quotaFor(
  fromAccountId: string,
  toAccountId: string,
  usage: DayUsage,
  settings: AppSettings,
): Quota {
  const lastTrade = usage.lastTradePerPair.get(pairKey(fromAccountId, toAccountId));
  return {
    receiveRemaining: Math.max(
      0,
      settings.shareReceivePerDay - (usage.receivedShare.get(toAccountId) ?? 0),
    ),
    pairSendRemaining: Math.max(
      0,
      settings.shareSendPerPairPerDay -
        (usage.sharePairs.get(pairKey(fromAccountId, toAccountId)) ?? 0),
    ),
    tradeFromRemaining: Math.max(
      0,
      settings.tradePerAccountPerDay - (usage.tradesPerAccount.get(fromAccountId) ?? 0),
    ),
    tradeToRemaining: Math.max(
      0,
      settings.tradePerAccountPerDay - (usage.tradesPerAccount.get(toAccountId) ?? 0),
    ),
    tradePairBlocked:
      lastTrade !== undefined && daysBetween(lastTrade, usage.gameDay) < settings.tradePairCooldownDays,
  };
}

export type CandidateBlock =
  | "receiveQuota"
  | "pairQuota"
  | "tradeCooldown"
  | "tradeFromQuota"
  | "tradeToQuota"
  | "noTradeBack"
  | "noStamina"
  | "noShinedust";

export type Candidate = {
  card: Card;
  method: "share" | "trade";
  senderQty: number;
  senderTarget: number;
  receiverQty: number;
  spare: number;
  tradeBack: { card: Card; qty: number } | null;
  cost: number;
  allowedNow: boolean;
  blockedReason: CandidateBlock | null;
};

type CandidateContext = {
  fromAccount: Account;
  toAccount: Account;
  cards: CardMap;
  holdings: HoldingsByAccount;
  settings: AppSettings;
  quota: Quota;
  now: Date;
};

function senderExState(context: CandidateContext) {
  return exGroups(context.fromAccount.id, context.cards, context.holdings, context.settings.exCountMode);
}

/** Boleh memberi walau tidak punya duplikat, asalkan jumlah ex unik tetap memenuhi min_ex. */
function keepsMinEx(
  card: Card,
  state: { unique: number; copies: Map<string, number> },
  context: CandidateContext,
): boolean {
  if (card.kind !== "ex") return false;
  const key = exIdentity(card, context.settings.exCountMode);
  const remainingOfIdentity = (state.copies.get(key) ?? 0) - 1;
  const uniqueAfter = state.unique - (remainingOfIdentity > 0 ? 0 : 1);
  return uniqueAfter >= context.fromAccount.minEx;
}

export function buildCandidates(context: CandidateContext): Candidate[] {
  const { fromAccount, toAccount, cards, holdings, settings, quota, now } = context;
  const senderHoldings = holdings.get(fromAccount.id) ?? new Map<string, HoldingState>();
  const receiverHoldings = holdings.get(toAccount.id) ?? new Map<string, HoldingState>();

  if (fromAccount.id === toAccount.id) return [];

  const senderResources = estimateResources(fromAccount, now, settings);

  const exState = senderExState(context);
  const tradeBacks = new Map<string, { card: Card; qty: number }>();
  for (const [cardId, state] of receiverHoldings) {
    const card = cards.get(cardId);
    if (!card || !card.tradable) continue;
    if (state.qty <= state.targetQty) continue;
    const existing = tradeBacks.get(card.rarityCode);
    if (!existing || state.qty > existing.qty) {
      tradeBacks.set(card.rarityCode, { card, qty: state.qty });
    }
  }

  const candidates: Candidate[] = [];
  for (const [cardId, state] of senderHoldings) {
    if (state.qty <= 0) continue;
    const card = cards.get(cardId);
    if (!card) continue;
    if (card.kind === "other") continue;

    const receiverQty = receiverHoldings.get(cardId)?.qty ?? 0;
    if (receiverQty > 0) continue;

    const method = transferMethod(card);
    if (!method) continue;

    const spare = state.qty - state.targetQty;

    if (method === "share") {
      if (!(spare > 0 || keepsMinEx(card, exState, context))) continue;
    } else if (spare <= 0) {
      continue;
    }

    const tradeBack = method === "trade" ? tradeBacks.get(card.rarityCode) ?? null : null;
    const blockedReasons: CandidateBlock[] = [];
    if (method === "share") {
      if (quota.receiveRemaining <= 0) blockedReasons.push("receiveQuota");
      if (quota.pairSendRemaining <= 0) blockedReasons.push("pairQuota");
    } else {
      if (senderResources.stamina < 1) blockedReasons.push("noStamina");
      if (senderResources.shinedust < tradeCost(card, settings.tradeCosts)) {
        blockedReasons.push("noShinedust");
      }
      if (quota.tradePairBlocked) blockedReasons.push("tradeCooldown");
      if (quota.tradeFromRemaining <= 0) blockedReasons.push("tradeFromQuota");
      if (quota.tradeToRemaining <= 0) blockedReasons.push("tradeToQuota");
      if (!tradeBack) blockedReasons.push("noTradeBack");
    }

    candidates.push({
      card,
      method,
      senderQty: state.qty,
      senderTarget: state.targetQty,
      receiverQty,
      spare,
      tradeBack,
      cost: method === "trade" ? tradeCost(card, settings.tradeCosts) : 0,
      allowedNow: blockedReasons.length === 0,
      blockedReason: blockedReasons[0] ?? null,
    });
  }

  const priority = (candidate: Candidate) => {
    const kindPriority = candidate.card.kind === "ex" ? 0 : candidate.card.kind === "trainer" ? 1 : 2;
    if (candidate.allowedNow) return kindPriority;
    return 10 + kindPriority;
  };

  return candidates.sort(
    (a, b) =>
      priority(a) - priority(b) ||
      a.card.rarityScore - b.card.rarityScore ||
      b.spare - a.spare ||
      a.card.name.localeCompare(b.card.name),
  );
}
