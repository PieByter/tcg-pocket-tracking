import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
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

const cardOutTable = alias(cardsTable, "card_out");
const cardInTable = alias(cardsTable, "card_in");

export const loadAccounts = cache(async (userId: string): Promise<Account[]> => {
  const db = await getDb();
  return db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.userId, userId))
    .orderBy(asc(accountsTable.sortOrder), asc(accountsTable.createdAt));
});

export const loadLedger = cache(async (userId: string): Promise<Ledger> => {
  const db = await getDb();

  // Satu gelombang query paralel (satu round-trip ke database) — sebelumnya
  // settings, accounts, holdings, transfers, dan kartu dimuat berurutan.
  const [settings, accounts, holdingRows, transferRows, catalogProbe] = await Promise.all([
    getSettings(userId),
    loadAccounts(userId),
    db
      .select({ holding: holdingsTable, card: cardsTable })
      .from(holdingsTable)
      .innerJoin(accountsTable, eq(accountsTable.id, holdingsTable.accountId))
      .innerJoin(cardsTable, eq(cardsTable.id, holdingsTable.cardId))
      .where(eq(accountsTable.userId, userId)),
    db
      .select({ transfer: transfersTable, cardOut: cardOutTable, cardIn: cardInTable })
      .from(transfersTable)
      .leftJoin(cardOutTable, eq(cardOutTable.id, transfersTable.cardOutId))
      .leftJoin(cardInTable, eq(cardInTable.id, transfersTable.cardInId))
      .where(eq(transfersTable.userId, userId))
      .orderBy(desc(transfersTable.createdAt))
      .limit(TRANSFER_LIMIT),
    db.select({ id: cardsTable.id }).from(cardsTable).limit(1),
  ]);

  const cards = buildCards([
    ...holdingRows.map((row) => row.card),
    ...transferRows.flatMap((row) =>
      [row.cardOut, row.cardIn].filter((card): card is Card => card !== null),
    ),
  ]);
  const holdings = buildHoldings(holdingRows.map((row) => row.holding));
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const now = new Date();
  const today = gameDayKey(now, settings);

  const transfers: LedgerTransfer[] = transferRows.flatMap(({ transfer, cardOut, cardIn }) => {
    const fromAccount = accountById.get(transfer.fromAccountId);
    const toAccount = accountById.get(transfer.toAccountId);
    if (!fromAccount || !toAccount) return [];
    return [{ ...transfer, fromAccount, toAccount, cardOut, cardIn }];
  });

  return {
    accounts,
    cards,
    holdings,
    transfers,
    settings,
    today,
    usage: computeUsage(
      transferRows.map((row) => row.transfer),
      today,
    ),
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

export async function loadInventoryPage(
  userId: string,
  filters: InventoryFilters,
): Promise<InventoryPage> {
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
    loadAccounts(userId),
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
  const accountIds = accounts.map((account) => account.id);
  const holdingRows =
    cardIds.length > 0 && accountIds.length > 0
      ? await db
          .select()
          .from(holdingsTable)
          .where(
            and(
              inArray(holdingsTable.cardId, cardIds),
              inArray(holdingsTable.accountId, accountIds),
            ),
          )
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

export type AlbumCard = { card: Card; qty: number };

export type AlbumData = {
  accounts: Account[];
  account: Account | null;
  cards: AlbumCard[];
  totalQty: number;
};

/** Semua kartu yang dimiliki satu akun, urut rarity tertinggi (Crown → Diamond 1). */
export async function loadAlbum(userId: string, accountId?: string): Promise<AlbumData> {
  const accounts = await loadAccounts(userId);
  const account = accounts.find((item) => item.id === accountId) ?? accounts[0] ?? null;
  if (!account) return { accounts, account: null, cards: [], totalQty: 0 };

  const db = await getDb();
  const rows = await db
    .select({ card: cardsTable, qty: holdingsTable.qty })
    .from(holdingsTable)
    .innerJoin(cardsTable, eq(cardsTable.id, holdingsTable.cardId))
    .where(and(eq(holdingsTable.accountId, account.id), sql`${holdingsTable.qty} > 0`))
    .orderBy(desc(cardsTable.rarityScore), asc(cardsTable.setCode), asc(cardsTable.number));

  return {
    accounts,
    account,
    cards: rows.map((row) => ({ card: row.card, qty: row.qty })),
    totalQty: rows.reduce((total, row) => total + row.qty, 0),
  };
}

export async function catalogCardCount(): Promise<number> {
  const db = await getDb();
  const rows = await db.select({ total: sql<number>`count(*)::int` }).from(cardsTable);
  return rows[0]?.total ?? 0;
}

export type DataStats = { accounts: number; holdings: number; transfers: number };

export async function loadDataStats(userId: string): Promise<DataStats> {
  const db = await getDb();
  const [accountRows, holdingRows, transferRows] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(accountsTable)
      .where(eq(accountsTable.userId, userId)),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(holdingsTable)
      .innerJoin(accountsTable, eq(accountsTable.id, holdingsTable.accountId))
      .where(eq(accountsTable.userId, userId)),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(transfersTable)
      .where(eq(transfersTable.userId, userId)),
  ]);
  return {
    accounts: accountRows[0]?.total ?? 0,
    holdings: holdingRows[0]?.total ?? 0,
    transfers: transferRows[0]?.total ?? 0,
  };
}
