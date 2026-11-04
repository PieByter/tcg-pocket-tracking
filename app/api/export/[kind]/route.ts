import { asc, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { accounts, cards as cardsTable, holdings, transfers } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import {
  backupFileName,
  buildBackupJson,
  buildCollectionCsv,
  buildTransfersCsv,
  type BackupHolding,
  type BackupTransfer,
} from "@/lib/export";
import { getSettings } from "@/lib/config";

export const dynamic = "force-dynamic";

const KINDS = ["json", "collection", "transfers"] as const;
type Kind = (typeof KINDS)[number];

function attachment(body: string, contentType: string, fileName: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

async function loadAccounts(userId: string) {
  const db = await getDb();
  return db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .orderBy(asc(accounts.sortOrder), asc(accounts.createdAt));
}

async function loadHoldings(userId: string): Promise<BackupHolding[]> {
  const db = await getDb();
  const rows = await db
    .select({ holding: holdings, card: cardsTable })
    .from(holdings)
    .innerJoin(cardsTable, eq(cardsTable.id, holdings.cardId))
    .innerJoin(accounts, eq(accounts.id, holdings.accountId))
    .where(eq(accounts.userId, userId));
  return rows.map((row) => ({ ...row.holding, card: row.card }));
}

async function loadTransfers(userId: string): Promise<BackupTransfer[]> {
  const db = await getDb();
  const outCard = alias(cardsTable, "out_card");
  const inCard = alias(cardsTable, "in_card");
  const [accountRows, rows] = await Promise.all([
    loadAccounts(userId),
    db
      .select({ transfer: transfers, cardOut: outCard, cardIn: inCard })
      .from(transfers)
      .innerJoin(outCard, eq(outCard.id, transfers.cardOutId))
      .leftJoin(inCard, eq(inCard.id, transfers.cardInId))
      .where(eq(transfers.userId, userId))
      .orderBy(desc(transfers.createdAt)),
  ]);

  const accountById = new Map(accountRows.map((account) => [account.id, account]));
  return rows.flatMap((row) => {
    const from = accountById.get(row.transfer.fromAccountId);
    const to = accountById.get(row.transfer.toAccountId);
    if (!from || !to) return [];
    return [{ ...row.transfer, from, to, cardOut: row.cardOut, cardIn: row.cardIn }];
  });
}

export async function GET(_request: NextRequest, context: { params: Promise<{ kind: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { kind } = await context.params;
  if (!KINDS.includes(kind as Kind)) {
    return new Response("Not found", { status: 404 });
  }

  const exportedAt = new Date();

  if (kind === "json") {
    const [accountRows, holdingRows, transferRows, settings] = await Promise.all([
      loadAccounts(user.id),
      loadHoldings(user.id),
      loadTransfers(user.id),
      getSettings(user.id),
    ]);
    return attachment(
      buildBackupJson({
        exportedAt,
        settings,
        accounts: accountRows,
        holdings: holdingRows,
        transfers: transferRows,
      }),
      "application/json; charset=utf-8",
      backupFileName("backup", exportedAt, "json"),
    );
  }

  if (kind === "collection") {
    const [accountRows, holdingRows] = await Promise.all([
      loadAccounts(user.id),
      loadHoldings(user.id),
    ]);
    return attachment(
      buildCollectionCsv(accountRows, holdingRows),
      "text/csv; charset=utf-8",
      backupFileName("collection", exportedAt, "csv"),
    );
  }

  return attachment(
    buildTransfersCsv(await loadTransfers(user.id)),
    "text/csv; charset=utf-8",
    backupFileName("transfers", exportedAt, "csv"),
  );
}
