import type { Account, Card, Holding, Transfer } from "@/db/schema";
import { rarityShort } from "./cards";
import { toCsv, withBom } from "./csv";
import type { AppSettings } from "./settings";

export type BackupHolding = Holding & { card: Card | null };
export type BackupTransfer = Transfer & {
  from: Account;
  to: Account;
  cardOut: Card | null;
  cardIn: Card | null;
};

export function backupFileName(prefix: string, exportedAt: Date, extension: string): string {
  const day = exportedAt.toISOString().slice(0, 10);
  return `pocketledger-${prefix}-${day}.${extension}`;
}

/** Backup lengkap: cukup untuk memulihkan ledger secara manual maupun lewat skrip. */
export function buildBackupJson(input: {
  exportedAt: Date;
  settings: AppSettings;
  accounts: Account[];
  holdings: BackupHolding[];
  transfers: BackupTransfer[];
}): string {
  const accountById = new Map(input.accounts.map((account) => [account.id, account]));
  const payload = {
    app: "pocketledger",
    version: 1,
    exportedAt: input.exportedAt.toISOString(),
    settings: input.settings,
    accounts: input.accounts.map((account) => ({
      name: account.name,
      friendCode: account.friendCode,
      minEx: account.minEx,
      sortOrder: account.sortOrder,
      notes: account.notes,
      tradeStamina: account.tradeStamina,
      shinedust: account.shinedust,
      resourcesUpdatedAt: account.resourcesUpdatedAt?.toISOString() ?? null,
      createdAt: account.createdAt?.toISOString() ?? null,
    })),
    holdings: input.holdings.flatMap((row) =>
      row.card
        ? [
            {
              account: accountById.get(row.accountId)?.name ?? row.accountId,
              cardId: row.cardId,
              name: row.card.name,
              setCode: row.card.setCode,
              number: row.card.number,
              qty: row.qty,
              targetQty: row.targetQty,
              updatedAt: row.updatedAt?.toISOString() ?? null,
            },
          ]
        : [],
    ),
    transfers: input.transfers.map((row) => ({
      id: row.id,
      status: row.status,
      method: row.method,
      from: row.from.name,
      to: row.to.name,
      cardOutId: row.cardOutId,
      cardOutName: row.cardOut?.name ?? null,
      cardInId: row.cardInId,
      cardInName: row.cardIn?.name ?? null,
      plannedDay: row.plannedDay,
      gameDay: row.gameDay,
      note: row.note,
      createdAt: row.createdAt?.toISOString() ?? null,
      sentAt: row.sentAt?.toISOString() ?? null,
      confirmedAt: row.confirmedAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
    })),
  };

  return JSON.stringify(payload, null, 2);
}

export const COLLECTION_HEADER = [
  "card_id",
  "set_code",
  "number",
  "name",
  "rarity",
  "account",
  "qty",
  "target_qty",
];

/** Satu baris per kartu per akun; kolomnya persis yang dibaca fitur impor. */
export function buildCollectionCsv(accounts: Account[], rows: BackupHolding[]): string {
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const body = [...rows]
    .filter((row) => row.card)
    .sort(
      (a, b) =>
        a.cardId.localeCompare(b.cardId) ||
        (accountById.get(a.accountId)?.sortOrder ?? 0) - (accountById.get(b.accountId)?.sortOrder ?? 0),
    )
    .map((row) => [
      row.cardId,
      row.card!.setCode,
      row.card!.number,
      row.card!.name,
      rarityShort(row.card!),
      accountById.get(row.accountId)?.name ?? row.accountId,
      row.qty,
      row.targetQty,
    ]);

  return withBom(toCsv([COLLECTION_HEADER, ...body]));
}

export const TRANSFERS_HEADER = [
  "id",
  "created_at",
  "planned_day",
  "game_day",
  "status",
  "method",
  "from_account",
  "to_account",
  "card_out",
  "card_out_name",
  "card_in",
  "card_in_name",
  "note",
];

export function buildTransfersCsv(rows: BackupTransfer[]): string {
  const body = rows.map((row) => [
    row.id,
    row.createdAt?.toISOString() ?? "",
    row.plannedDay,
    row.gameDay,
    row.status,
    row.method,
    row.from.name,
    row.to.name,
    row.cardOutId,
    row.cardOut?.name ?? "",
    row.cardInId,
    row.cardIn?.name ?? "",
    row.note,
  ]);

  return withBom(toCsv([TRANSFERS_HEADER, ...body]));
}
