// One-off importer: takes the JSON produced by scripts/import-tcg-list.py and
// replaces the target user's accounts/holdings with the spreadsheet data.
//
// Usage:
//   npx tsx scripts/migrate-tcg-list.ts --email admin@gmail.com            # dry-run
//   npx tsx scripts/migrate-tcg-list.ts --email admin@gmail.com --apply    # write
//
// Sheet -> tier mapping (in-game rarity):
//   💠 / 💠💠 / 💠💠💠 / 💠💠💠💠 -> Diamond C / U / R / RR
//   ⭐ -> SR (1 star), ⭐⭐ -> SAR (2 stars), ⭐⭐⭐ -> IM (immersive)
//   ✨ -> S (shiny), ✨✨ -> SSR (shiny ex), 👑 -> UR (crown)
import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";

type Db = PostgresJsDatabase<typeof schema>;

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(path.join(process.cwd(), file));
  } catch {
    // optional
  }
}

type Extracted = {
  sheets: {
    sheet: string;
    blocks: { account: string; tiers: string[]; rows: { name: string; qty: Record<string, number> }[] }[];
  }[];
};

type Card = { id: string; name: string; setCode: string; number: number; rarityGroup: string; rarityCode: string };

const TIER_RARITY: Record<string, [string, string[]]> = {
  Diamond1: ["Diamond", ["C"]],
  Diamond2: ["Diamond", ["U"]],
  Diamond3: ["Diamond", ["R"]],
  Diamond4: ["Diamond", ["RR"]],
  Star1: ["Star", ["SR", "AR"]],
  Star2: ["Star", ["SAR"]],
  Star3: ["Star", ["IM"]],
  Shiny1: ["Shiny", ["S"]],
  Shiny2: ["Shiny", ["SSR"]],
  Crown1: ["Crown", ["UR"]],
};

const EXCLUDED_SHEETS = new Set(["1-3"]); // deck list, not a collection
const REGIONS = ["paldea", "paldean", "alolan", "galarian", "hisuian", "mega"];

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function variants(rawName: string): string[] {
  const base = normalize(rawName);
  const noNumber = base.replace(/\s+\d+$/, "");
  const regionPrefix = new RegExp(`^(${[...REGIONS].sort((a, b) => b.length - a.length).join("|")}) `);
  const region = base.replace(regionPrefix, "");
  const names = new Set<string>();
  for (const name of [base, noNumber, region]) {
    if (!name) continue;
    names.add(name);
    names.add(`${name} ex`);
  }
  return [...names];
}

function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = temp;
    }
  }
  return prev[b.length];
}

function parseArgs(argv: string[]) {
  const args = { email: "", input: ".data/tcg-list.json", apply: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--email") args.email = argv[++i] ?? "";
    else if (arg === "--input") args.input = argv[++i] ?? args.input;
    else if (arg === "--apply") args.apply = true;
  }
  return args;
}

async function connect() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL belum diisi di .env.local.");
  const [{ default: postgres }, { drizzle }] = await Promise.all([
    import("postgres"),
    import("drizzle-orm/postgres-js"),
  ]);
  const client = postgres(url, {
    prepare: false,
    max: 1,
    ssl: /sslmode=require|ssl=true/.test(url) ? "require" : undefined,
  });
  return { client, db: drizzle(client, { schema }) as unknown as Db };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.email) throw new Error("--email wajib diisi.");

  const extracted = JSON.parse(await readFile(path.join(process.cwd(), args.input), "utf8")) as Extracted;
  const catalog = JSON.parse(
    await readFile(path.join(process.cwd(), "data", "catalog.json"), "utf8"),
  ) as { cards: Card[]; sets: { code: string; releaseDate: string | null }[] };

  const setOrder = new Map<string, number>(
    [...catalog.sets]
      .sort((a, b) => (a.releaseDate ?? "9999").localeCompare(b.releaseDate ?? "9999"))
      .map((set, index) => [set.code, index]),
  );
  const setRank = (card: Card) =>
    card.setCode.startsWith("PROMO") ? 10_000 : (setOrder.get(card.setCode) ?? 9_000);

  const exact = new Map<string, Card[]>();
  const byRarity = new Map<string, Card[]>();
  for (const card of catalog.cards) {
    const nameKey = `${normalize(card.name)}|${card.rarityGroup}|${card.rarityCode}`;
    if (!exact.has(nameKey)) exact.set(nameKey, []);
    exact.get(nameKey)!.push(card);
    const rarityKey = `${card.rarityGroup}|${card.rarityCode}`;
    if (!byRarity.has(rarityKey)) byRarity.set(rarityKey, []);
    byRarity.get(rarityKey)!.push(card);
  }

  function match(rawName: string, tier: string): { card: Card | null; how: "exact" | "fuzzy" | "none" } {
    const rarity = TIER_RARITY[tier];
    if (!rarity) return { card: null, how: "none" };
    const [group, codes] = rarity;
    const names = variants(rawName);

    const found: Card[] = [];
    for (const name of names) {
      for (const code of codes) found.push(...(exact.get(`${name}|${group}|${code}`) ?? []));
    }
    if (found.length > 0) {
      const unique = [...new Map(found.map((card) => [card.id, card])).values()];
      unique.sort((a, b) => setRank(a) - setRank(b) || a.number - b.number);
      return { card: unique[0], how: "exact" };
    }

    let bestScore = 99;
    let best: Card[] = [];
    for (const code of codes) {
      for (const card of byRarity.get(`${group}|${code}`) ?? []) {
        let score = 99;
        for (const name of names) score = Math.min(score, distance(name, normalize(card.name)));
        if (score > 2 || score > bestScore) continue;
        if (!best.some((candidate) => candidate.id === card.id)) best.push(card);
        bestScore = score;
      }
    }
    if (best.length === 0) return { card: null, how: "none" };
    // Distance 2 is a loose guess: only accept it when exactly one card matches.
    if (bestScore === 2 && best.length > 1) return { card: null, how: "none" };
    best.sort((a, b) => setRank(a) - setRank(b) || a.number - b.number);
    return { card: best[0], how: "fuzzy" };
  }

  const accounts = new Map<string, Map<string, number>>();
  const unmatched = new Map<string, number>();
  let fuzzy = 0;
  let mapped = 0;

  for (const sheet of extracted.sheets) {
    if (EXCLUDED_SHEETS.has(sheet.sheet)) continue;
    for (const block of sheet.blocks) {
      const account = block.account.trim();
      if (!account) continue;
      const holdings = accounts.get(account) ?? new Map<string, number>();
      for (const row of block.rows) {
        for (const [tier, qty] of Object.entries(row.qty)) {
          const { card, how } = match(row.name, tier);
          if (!card) {
            const key = `${row.name} [${tier}]`;
            unmatched.set(key, (unmatched.get(key) ?? 0) + 1);
            continue;
          }
          if (how === "fuzzy") fuzzy++;
          mapped++;
          holdings.set(card.id, Math.max(holdings.get(card.id) ?? 0, Math.round(qty)));
        }
      }
      accounts.set(account, holdings);
    }
  }

  console.log(`Akun (${accounts.size}):`);
  for (const [account, holdings] of accounts) console.log(`  - ${account}: ${holdings.size} kartu`);
  console.log(`Entry terpakai: ${mapped} (fuzzy: ${fuzzy})`);
  console.log(`Entry tidak cocok: ${[...unmatched.values()].reduce((a, b) => a + b, 0)} baris / ${unmatched.size} unik`);
  if (unmatched.size > 0) {
    const list = [...unmatched.entries()].sort((a, b) => b[1] - a[1]);
    for (const [key, count] of list.slice(0, 40)) console.log(`  ? ${key} x${count}`);
    if (list.length > 40) console.log(`  ... dan ${list.length - 40} lainnya`);
  }

  const { client, db } = await connect();
  try {
    const rows = (await client`select id from auth.users where lower(email) = lower(${args.email}) limit 1`) as { id: string }[];
    const userId = rows[0]?.id;
    if (!userId) throw new Error(`User ${args.email} tidak ditemukan di auth.users.`);
    console.log(`Target user: ${args.email} (${userId})`);

    const existing = await db.select({ id: schema.accounts.id }).from(schema.accounts).where(eq(schema.accounts.userId, userId));
    console.log(`Data lama: ${existing.length} akun, dihapus lalu diganti data spreadsheet.`);

    if (!args.apply) {
      console.log("\nDry-run. Tambahkan --apply untuk menulis ke database.");
      return;
    }

    await db.transaction(async (tx) => {
      await tx.delete(schema.transfers).where(eq(schema.transfers.userId, userId));
      await tx.delete(schema.accounts).where(eq(schema.accounts.userId, userId));

      const inserted = await tx
        .insert(schema.accounts)
        .values(
          [...accounts.keys()].map((name, index) => ({
            userId,
            name,
            minEx: 2,
            sortOrder: index,
          })),
        )
        .returning({ id: schema.accounts.id, name: schema.accounts.name });

      const idByName = new Map(inserted.map((row) => [row.name, row.id]));
      const values: (typeof schema.holdings.$inferInsert)[] = [];
      for (const [account, holdings] of accounts) {
        const accountId = idByName.get(account);
        if (!accountId) continue;
        for (const [cardId, qty] of holdings) {
          if (qty <= 0) continue;
          values.push({ accountId, cardId, qty, targetQty: 0 });
        }
      }
      for (let index = 0; index < values.length; index += 500) {
        await tx.insert(schema.holdings).values(values.slice(index, index + 500));
      }
      console.log(`Ditulis: ${inserted.length} akun, ${values.length} holdings.`);
    });
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
