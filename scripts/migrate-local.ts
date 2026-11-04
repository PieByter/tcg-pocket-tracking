import { mkdirSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";

type Db = PostgresJsDatabase<typeof schema>;

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(path.join(process.cwd(), file));
  } catch {
    // File opsional.
  }
}

const MIGRATIONS = path.join(process.cwd(), "drizzle");

type AccountRow = {
  id: string;
  name: string;
  friend_code: string | null;
  min_ex: number;
  sort_order: number;
  notes: string | null;
  trade_stamina: number;
  shinedust: number;
  resources_updated_at: string | Date;
  created_at: string | Date;
};

type HoldingRow = {
  account_id: string;
  card_id: string;
  qty: number;
  target_qty: number;
  updated_at: string | Date;
};

type TransferRow = {
  id: string;
  method: "share" | "trade";
  from_account_id: string;
  to_account_id: string;
  card_out_id: string;
  card_in_id: string | null;
  status: "planned" | "sent" | "confirmed" | "cancelled";
  planned_day: string | null;
  game_day: string | null;
  note: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  sent_at: string | Date | null;
  confirmed_at: string | Date | null;
  cancelled_at: string | Date | null;
};

type ConfigRow = { key: string; value: string; updated_at: string | Date };

function toDate(value: string | Date | null): Date | null {
  if (value === null) return null;
  return value instanceof Date ? value : new Date(value);
}

/** PGlite mengembalikan kolom `date` sebagai Date; schema Drizzle memakai mode string. */
function toDay(value: string | Date | null): string | null {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL belum diisi di .env.local. Skrip ini butuh koneksi Supabase sebagai tujuan.",
    );
  }
  const email = process.env.SEED_USER_EMAIL?.trim();
  if (!email) {
    throw new Error(
      "SEED_USER_EMAIL belum diisi. Isi email user Supabase yang sudah terdaftar di .env.local.",
    );
  }

  const [{ PGlite }, { default: postgres }, { drizzle }, { migrate }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("postgres"),
    import("drizzle-orm/postgres-js"),
    import("drizzle-orm/postgres-js/migrator"),
  ]);

  const dataDir = process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), ".data", "pocketledger");
  mkdirSync(dataDir, { recursive: true });
  const source = new PGlite(dataDir);

  const client = postgres(url, {
    prepare: false,
    max: 1,
    ssl: /sslmode=require|ssl=true/.test(url) ? "require" : undefined,
  });
  const db = drizzle(client, { schema }) as unknown as Db;

  try {
    await migrate(db as never, { migrationsFolder: MIGRATIONS });

    const users =
      await client`select id from auth.users where lower(email) = lower(${email}) limit 1`;
    const userId = (users[0] as { id?: string } | undefined)?.id;
    if (!userId) {
      throw new Error(`User ${email} tidak ditemukan di auth.users. Daftar lewat /register dulu.`);
    }

    const sourceTables = await source.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_name = 'accounts'`,
    );
    if (sourceTables.rows.length === 0) {
      throw new Error(
        "Database lokal (PGlite) belum punya tabel. Jalankan `npm run db:seed` dulu sebelum migrasi.",
      );
    }

    const accounts = (
      await source.query<AccountRow>(
        `select id, name, friend_code, min_ex, sort_order, notes, trade_stamina, shinedust,
                resources_updated_at, created_at
         from accounts order by sort_order, created_at`,
      )
    ).rows;

    const holdings = (
      await source.query<HoldingRow>(
        `select account_id, card_id, qty, target_qty, updated_at from holdings`,
      )
    ).rows;

    const transfers = (
      await source.query<TransferRow>(
        `select id, method, from_account_id, to_account_id, card_out_id, card_in_id, status,
                planned_day, game_day, note, created_at, updated_at, sent_at, confirmed_at, cancelled_at
         from transfers order by created_at`,
      )
    ).rows;

    const config = (
      await source.query<ConfigRow>(`select key, value, updated_at from app_config`)
    ).rows;

    if ((holdings.length > 0 || transfers.length > 0) && (await client`select 1 from cards limit 1`).length === 0) {
      throw new Error(
        "Katalog kartu di Supabase masih kosong. Jalankan `npm run db:seed` dulu (butuh SEED_USER_EMAIL) sebelum migrasi.",
      );
    }

    await db.transaction(async (tx) => {
      await tx.delete(schema.transfers).where(eq(schema.transfers.userId, userId));
      await tx.delete(schema.accounts).where(eq(schema.accounts.userId, userId));
      await tx.delete(schema.appConfig).where(eq(schema.appConfig.userId, userId));

      if (accounts.length > 0) {
        await tx.insert(schema.accounts).values(
          accounts.map((row) => ({
            id: row.id,
            userId,
            name: row.name,
            friendCode: row.friend_code,
            minEx: row.min_ex,
            sortOrder: row.sort_order,
            notes: row.notes,
            tradeStamina: row.trade_stamina,
            shinedust: row.shinedust,
            resourcesUpdatedAt: toDate(row.resources_updated_at) ?? new Date(),
            createdAt: toDate(row.created_at) ?? new Date(),
          })),
        );
      }

      if (holdings.length > 0) {
        await tx.insert(schema.holdings).values(
          holdings.map((row) => ({
            accountId: row.account_id,
            cardId: row.card_id,
            qty: row.qty,
            targetQty: row.target_qty,
            updatedAt: toDate(row.updated_at) ?? new Date(),
          })),
        );
      }

      if (transfers.length > 0) {
        await tx.insert(schema.transfers).values(
          transfers.map((row) => ({
            id: row.id,
            userId,
            method: row.method,
            fromAccountId: row.from_account_id,
            toAccountId: row.to_account_id,
            cardOutId: row.card_out_id,
            cardInId: row.card_in_id,
            status: row.status,
            plannedDay: toDay(row.planned_day),
            gameDay: toDay(row.game_day),
            note: row.note,
            createdAt: toDate(row.created_at) ?? new Date(),
            updatedAt: toDate(row.updated_at) ?? new Date(),
            sentAt: toDate(row.sent_at),
            confirmedAt: toDate(row.confirmed_at),
            cancelledAt: toDate(row.cancelled_at),
          })),
        );
      }

      if (config.length > 0) {
        await tx.insert(schema.appConfig).values(
          config.map((row) => ({
            userId,
            key: row.key,
            value: row.value,
            updatedAt: toDate(row.updated_at) ?? new Date(),
          })),
        );
      }
    });

    console.log(
      `Selesai: ${accounts.length} akun, ${holdings.length} holding, ${transfers.length} transfer, ${config.length} setting dipindahkan ke ${email}.`,
    );
  } finally {
    await client.end({ timeout: 5 });
    await source.close();
  }
}

main().catch((error) => {
  const cause = error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined;
  console.error(cause instanceof Error ? cause.message : error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
