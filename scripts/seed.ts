import { mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import { DEFAULT_SETTINGS, serializeSettings } from "@/lib/settings";

type Db = PostgresJsDatabase<typeof schema>;

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(path.join(process.cwd(), file));
  } catch {
    // File opsional.
  }
}

type CatalogCard = typeof schema.cards.$inferInsert;
type Catalog = {
  cards: CatalogCard[];
};

const MIGRATIONS = path.join(process.cwd(), "drizzle");

async function connect() {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const [{ default: postgres }, { drizzle }, { migrate }] = await Promise.all([
      import("postgres"),
      import("drizzle-orm/postgres-js"),
      import("drizzle-orm/postgres-js/migrator"),
    ]);
    const client = postgres(url, {
      prepare: false,
      max: 1,
      ssl: /sslmode=require|ssl=true/.test(url) ? "require" : undefined,
    });
    const db = drizzle(client, { schema }) as unknown as Db;
    await migrate(db as never, { migrationsFolder: MIGRATIONS });
    return { db, close: () => client.end({ timeout: 5 }) };
  }

  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
  ]);
  const dataDir = process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), ".data", "pocketledger");
  mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema }) as unknown as Db;
  await migrate(db as never, { migrationsFolder: MIGRATIONS });
  return { db, close: () => client.close() };
}

const DEMO_ACCOUNTS = [
  { name: "Akun 1: Main", friendCode: "1042-9938-4412", minEx: 2 },
  { name: "Akun 2: Kanto Rush", friendCode: "2210-8845-1097", minEx: 2 },
  { name: "Akun 3: Starter Blue", friendCode: "3391-2204-8876", minEx: 2 },
  { name: "Akun 4: Grass Volt", friendCode: "4470-1123-6690", minEx: 2 },
  { name: "Akun 5: Psychic Lab", friendCode: "5582-9931-2204", minEx: 2 },
  { name: "Akun 6: Fire Core", friendCode: "8492-1104-9921", minEx: 2 },
  { name: "Akun 7: Pika Spark", friendCode: "6613-4471-9932", minEx: 2 },
  { name: "Akun 8: Alt Rolling", friendCode: "7724-5512-3308", minEx: 2 },
];

async function main() {
  const demo = process.argv.includes("--demo");
  const catalog = JSON.parse(
    await readFile(path.join(process.cwd(), "data", "catalog.json"), "utf8"),
  ) as Catalog;

  if (!catalog.cards?.length) {
    throw new Error("data/catalog.json kosong. Jalankan `npm run catalog:build` dulu.");
  }

  const { db, close } = await connect();
  try {
    console.log(`Upserting ${catalog.cards.length} kartu...`);
    for (let index = 0; index < catalog.cards.length; index += 400) {
      const chunk = catalog.cards.slice(index, index + 400);
      await db
        .insert(schema.cards)
        .values(chunk)
        .onConflictDoUpdate({
          target: schema.cards.id,
          set: {
            name: schema.cards.name,
            setName: schema.cards.setName,
            rarityCode: schema.cards.rarityCode,
            rarityLabel: schema.cards.rarityLabel,
            rarityGroup: schema.cards.rarityGroup,
            rarityRank: schema.cards.rarityRank,
            rarityScore: schema.cards.rarityScore,
            kind: schema.cards.kind,
            shareable: schema.cards.shareable,
            tradable: schema.cards.tradable,
            element: schema.cards.element,
            imageUrl: schema.cards.imageUrl,
          },
        });
    }

    const existingAccounts = await db.select({ id: schema.accounts.id }).from(schema.accounts);
    let accountIds = existingAccounts.map((row) => row.id);

    if (accountIds.length === 0) {
      const inserted = await db
        .insert(schema.accounts)
        .values(DEMO_ACCOUNTS.map((account, index) => ({ ...account, sortOrder: index })))
        .returning({ id: schema.accounts.id });
      accountIds = inserted.map((row) => row.id);
      console.log(`Membuat ${accountIds.length} akun default.`);
    }

    await db
      .insert(schema.appConfig)
      .values(serializeSettings(DEFAULT_SETTINGS))
      .onConflictDoNothing();

    if (demo) {
      const existingHoldings = await db.select({ accountId: schema.holdings.accountId }).from(schema.holdings).limit(1);
      if (existingHoldings.length > 0) {
        console.log("Holdings sudah ada, seeding demo dilewati.");
      } else {
        const exCards = catalog.cards.filter(
          (card) => card.kind === "ex" && card.rarityCode === "RR" && card.setCode === "A1",
        );
        const trainerCards = catalog.cards.filter(
          (card) => card.kind === "trainer" && card.rarityGroup === "Diamond" && card.rarityRank <= 3,
        );
        const values: typeof schema.holdings.$inferInsert[] = [];
        const exTargets = [4, 2, 1, 3, 3, 1, 2, 2];

        accountIds.forEach((accountId, index) => {
          const exCount = exTargets[index] ?? 2;
          for (let offset = 0; offset < exCount; offset += 1) {
            const card = exCards[(index * 3 + offset) % exCards.length];
            values.push({
              accountId,
              cardId: card.id,
              qty: (index + offset) % 4 === 0 ? 2 : 1,
              targetQty: 1,
            });
          }
          for (let offset = 0; offset < 6; offset += 1) {
            const card = trainerCards[(index * 5 + offset) % trainerCards.length];
            const qty = (index + offset) % 3 === 0 ? 0 : ((index + offset) % 3) + 1;
            values.push({ accountId, cardId: card.id, qty, targetQty: 2 });
          }
        });

        const deduped = new Map(values.map((row) => [`${row.accountId}|${row.cardId}`, row]));
        await db.insert(schema.holdings).values([...deduped.values()]);
        console.log(`Holdings demo dibuat: ${deduped.size} baris.`);
      }
    }

    console.log("Seed selesai.");
  } finally {
    await close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
