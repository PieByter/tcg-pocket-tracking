import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { accounts as accountsTable, cards as cardsTable, holdings as holdingsTable, transfers as transfersTable } from "@/db/schema";
import type { Account, Card, Transfer } from "@/db/schema";
import { getSettings, type AppSettings } from "./config";
import {
  type AccountSummary,
  type CardMap,
  type DayUsage,
  type HoldingsByAccount,
  buildCards,
  buildHoldings,
  computeUsage,
  summarizeAccounts,
} from "./domain";
import { gameDayKey, minutesUntilReset } from "./game-day";

export type LedgerTransfer = Transfer & {
  fromAccount: Account;
  toAccount: Account;
  cardOut: Card | null;
  cardIn: Card | null;
};

export type Ledger = {
  accounts: Account[];
  cards: CardMap;
  holdings: HoldingsByAccount;
  transfers: LedgerTransfer[];
  settings: AppSettings;
  today: string;
  usage: DayUsage;
  summaries: AccountSummary[];
  resetsInMinutes: number;
  catalogEmpty: boolean;
};

const TRANSFER_LIMIT = 200;

async function loadCards(ids: string[]): Promise<Card[]> {
  if (ids.length === 0) return [];
  const db = await getDb();
  const unique = [...new Set(ids)];
  const chunks: string[][] = [];
  for (let index = 0; index < unique.length; index += 500) {
    chunks.push(unique.slice(index, index + 500));
  }
  const rows: Card[] = [];
  for (const chunk of chunks) {
    rows.push(...(await db.select().from(cardsTable).where(inArray(cardsTable.id, chunk))));
  }
  return rows;
}

export const loadAccounts = cache(async (): Promise<Account[]> => {
  const db = await getDb();
  return db
    .select()
    .from(accountsTable)
    .orderBy(asc(accountsTable.sortOrder), asc(accountsTable.createdAt));
});

export const loadLedger = cache(async (): Promise<Ledger> => {
  const db = await getDb();
  const settings = await getSettings();
  const [accounts, holdingRows, transferRows, catalogProbe] = await Promise.all([
    loadAccounts(),
    db.select().from(holdingsTable),
    db.select().from(transfersTable).orderBy(desc(transfersTable.createdAt)).limit(TRANSFER_LIMIT),
    db.select({ id: cardsTable.id }).from(cardsTable).limit(1),
  ]);

  const cardRows = await loadCards([
    ...holdingRows.map((row) => row.cardId),
    ...transferRows.flatMap((row) => [row.cardOutId, row.cardInId].filter((id): id is string => Boolean(id))),
  ]);

  const cards = buildCards(cardRows);
  const holdings = buildHoldings(holdingRows);
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const now = new Date();
  const today = gameDayKey(now, settings);

  const transfers: LedgerTransfer[] = transferRows.flatMap((row) => {
    const fromAccount = accountById.get(row.fromAccountId);
    const toAccount = accountById.get(row.toAccountId);
    if (!fromAccount || !toAccount) return [];
    return [
      {
        ...row,
        fromAccount,
        toAccount,
        cardOut: cards.get(row.cardOutId) ?? null,
        cardIn: row.cardInId ? cards.get(row.cardInId) ?? null : null,
      },
    ];
  });

  return {
    accounts,
    cards,
    holdings,
    transfers,
    settings,
    today,
    usage: computeUsage(transferRows, today),
    summaries: summarizeAccounts(accounts, cards, holdings, settings),
    resetsInMinutes: minutesUntilReset(now, settings),
    catalogEmpty: catalogProbe.length === 0,
  };
});

export type InventoryRow = {
  card: Card;
  perAccount: Record<string, { qty: number; targetQty: number }>;
};

export type InventoryFilters = {
  search?: string;
  setCode?: string;
  kind?: "focus" | "ex" | "trainer" | "other" | "all";
  rarity?: string;
  page?: number;
};

export type InventoryPage = {
  rows: InventoryRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  sets: { code: string; name: string }[];
  accounts: Account[];
};

export const INVENTORY_PAGE_SIZE = 40;

export async function loadInventoryPage(filters: InventoryFilters): Promise<InventoryPage> {
  const db = await getDb();
  const page = Math.max(1, filters.page ?? 1);
  const conditions: SQL[] = [];

  const search = filters.search?.trim();
  if (search) {
    conditions.push(
      or(ilike(cardsTable.name, `%${search}%`), ilike(cardsTable.id, `%${search}%`))!,
    );
  }
  if (filters.setCode && filters.setCode !== "all") {
    conditions.push(eq(cardsTable.setCode, filters.setCode));
  }
  if (filters.rarity && filters.rarity !== "all") {
    conditions.push(eq(cardsTable.rarityGroup, filters.rarity));
  }

  const kind = filters.kind ?? "focus";
  if (kind === "focus") {
    conditions.push(
      or(
        eq(cardsTable.kind, "ex"),
        and(eq(cardsTable.kind, "trainer"), eq(cardsTable.rarityGroup, "Diamond"), lte(cardsTable.rarityRank, 3)),
      )!,
    );
  } else if (kind !== "all") {
    conditions.push(eq(cardsTable.kind, kind));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [accounts, setRows, countRows, rows] = await Promise.all([
    loadAccounts(),
    db
      .selectDistinct({ code: cardsTable.setCode, name: cardsTable.setName })
      .from(cardsTable)
      .orderBy(desc(cardsTable.setCode)),
    db.select({ total: sql<number>`count(*)::int` }).from(cardsTable).where(where),
    db
      .select()
      .from(cardsTable)
      .where(where)
      .orderBy(desc(cardsTable.setCode), asc(cardsTable.number))
      .limit(INVENTORY_PAGE_SIZE)
      .offset((page - 1) * INVENTORY_PAGE_SIZE),
  ]);

  const total = countRows[0]?.total ?? 0;
  const cardIds = rows.map((row) => row.id);
  const holdingRows =
    cardIds.length > 0
      ? await db.select().from(holdingsTable).where(inArray(holdingsTable.cardId, cardIds))
      : [];

  const holdings = buildHoldings(holdingRows);

  return {
    rows: rows.map((card) => ({
      card,
      perAccount: Object.fromEntries(
        accounts.map((account) => {
          const state = holdings.get(account.id)?.get(card.id);
          return [account.id, { qty: state?.qty ?? 0, targetQty: state?.targetQty ?? 0 }];
        }),
      ),
    })),
    total,
    page,
    pageSize: INVENTORY_PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / INVENTORY_PAGE_SIZE)),
    sets: setRows,
    accounts,
  };
}

export async function catalogCardCount(): Promise<number> {
  const db = await getDb();
  const rows = await db.select({ total: sql<number>`count(*)::int` }).from(cardsTable);
  return rows[0]?.total ?? 0;
}

export type DataStats = { accounts: number; holdings: number; transfers: number };

export async function loadDataStats(): Promise<DataStats> {
  const db = await getDb();
  const [accountRows, holdingRows, transferRows] = await Promise.all([
    db.select({ total: sql<number>`count(*)::int` }).from(accountsTable),
    db.select({ total: sql<number>`count(*)::int` }).from(holdingsTable),
    db.select({ total: sql<number>`count(*)::int` }).from(transfersTable),
  ]);
  return {
    accounts: accountRows[0]?.total ?? 0,
    holdings: holdingRows[0]?.total ?? 0,
    transfers: transferRows[0]?.total ?? 0,
  };
}
