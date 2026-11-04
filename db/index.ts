import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

type GlobalDb = typeof globalThis & { __pocketledgerDb?: Promise<Db> };
const globalDb = globalThis as GlobalDb;

function sslOption(url: string) {
  return /sslmode=require|ssl=true/.test(url) ? ("require" as const) : undefined;
}

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL?.trim();

  if (url) {
    const [{ default: postgres }, { drizzle }] = await Promise.all([
      import("postgres"),
      import("drizzle-orm/postgres-js"),
    ]);
    const client = postgres(url, {
      // Supabase's transaction pooler (port 6543) does not support prepared statements.
      prepare: false,
      max: 5,
      idle_timeout: 20,
      connect_timeout: 15,
      ssl: sslOption(url),
    });
    return drizzle(client, { schema }) as unknown as Db;
  }

  if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_DB !== "1") {
    throw new Error(
      "DATABASE_URL is not set. Point it at your Supabase Postgres connection string (or set ALLOW_LOCAL_DB=1 for a local file database).",
    );
  }

  // Local development without Supabase: an embedded Postgres (PGlite) stored on disk.
  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
  ]);
  const dataDir = process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), ".data", "pocketledger");
  mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema }) as unknown as Db;
  await migrate(db as never, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db;
}

export function getDb(): Promise<Db> {
  globalDb.__pocketledgerDb ??= createDb().catch((error) => {
    globalDb.__pocketledgerDb = undefined;
    throw error;
  });
  return globalDb.__pocketledgerDb;
}
