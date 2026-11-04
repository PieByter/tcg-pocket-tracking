import { asc, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { accounts, cards as cardsTable, holdings, transfers } from "@/db/schema";
import { readSession } from "@/lib/auth";
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

async function loadAccounts() {
  const db = await getDb();
  return db.select().from(accounts).orderBy(asc(accounts.sortOrder), asc(accounts.createdAt));
}

async function loadHoldings(): Promise<BackupHolding[]> {
  const db = await getDb();
  const rows = await db
    .select({ holding: holdings, card: cardsTable })
    .from(holdings)
    .innerJoin(cardsTable, eq(cardsTable.id, holdings.cardId));
  return rows.map((row) => ({ ...row.holding, card: row.card }));
}

async function loadTransfers(): Promise<BackupTransfer[]> {
  const db = await getDb();
  const outCard = alias(cardsTable, "out_card");
  const inCard = alias(cardsTable, "in_card");
  const [accountRows, rows] = await Promise.all([
    loadAccounts(),
    db
      .select({ transfer: transfers, cardOut: outCard, cardIn: inCard })
      .from(transfers)
      .innerJoin(outCard, eq(outCard.id, transfers.cardOutId))
      .leftJoin(inCard, eq(inCard.id, transfers.cardInId))
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
  if (!(await readSession())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { kind } = await context.params;
  if (!KINDS.includes(kind as Kind)) {
    return new Response("Not found", { status: 404 });
  }

  const exportedAt = new Date();

  if (kind === "json") {
    const [accountRows, holdingRows, transferRows, settings] = await Promise.all([
      loadAccounts(),
      loadHoldings(),
      loadTransfers(),
      getSettings(),
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
    const [accountRows, holdingRows] = await Promise.all([loadAccounts(), loadHoldings()]);
    return attachment(
      buildCollectionCsv(accountRows, holdingRows),
      "text/csv; charset=utf-8",
      backupFileName("collection", exportedAt, "csv"),
    );
  }

  return attachment(
    buildTransfersCsv(await loadTransfers()),
    "text/csv; charset=utf-8",
    backupFileName("transfers", exportedAt, "csv"),
  );
}
