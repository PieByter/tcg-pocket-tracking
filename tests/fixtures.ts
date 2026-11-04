import type { Account, Card } from "@/db/schema";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings";
import type { HoldingsByAccount } from "@/lib/domain";

export const settings: AppSettings = { ...DEFAULT_SETTINGS };

export function account(id: string, overrides: Partial<Account> = {}): Account {
  return {
    id,
    userId: "user-1",
    name: `Akun ${id}`,
    friendCode: null,
    minEx: 2,
    sortOrder: 0,
    notes: null,
    tradeStamina: 5,
    shinedust: 50_000,
    resourcesUpdatedAt: new Date("2026-11-04T00:00:00Z"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

export function card(id: string, overrides: Partial<Card> = {}): Card {
  const [setCode, number] = id.split("-");
  return {
    id,
    setCode: setCode ?? "A1",
    setName: "Genetic Apex",
    number: Number(number ?? 1),
    name: `Kartu ${id}`,
    rarityCode: "RR",
    rarityLabel: "Double Rare",
    rarityGroup: "Diamond",
    rarityRank: 4,
    rarityScore: 14,
    kind: "ex",
    shareable: true,
    tradable: true,
    element: null,
    imageUrl: `https://example.test/${id}.webp`,
    ...overrides,
  };
}

export type HoldingsInput = Record<string, AccountHoldings>;
export type AccountHoldings = Record<string, { qty: number; targetQty: number }>;

export function holdings(entries: HoldingsInput): HoldingsByAccount {
  return new Map(
    Object.entries(entries).map(([accountId, cards]) => [
      accountId,
      new Map(Object.entries(cards).map(([cardId, state]) => [cardId, { ...state }])),
    ]),
  );
}

export function cardMap(cards: Card[]) {
  return new Map(cards.map((item) => [item.id, item]));
}
