// Regenerates data/catalog.json from the community "pokemon-tcg-pocket-database" dataset.
// Run with: npm run catalog:build
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://raw.githubusercontent.com/flibustier/pokemon-tcg-pocket-database/main/dist";
const IMAGE_BASE =
  "https://raw.githubusercontent.com/flibustier/pokemon-tcg-exchange/main/public/images/thumbnails";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

async function getJson(path) {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.json();
}

const [cards, extra, rarities, setsBySeries] = await Promise.all([
  getJson("cards.json"),
  getJson("cards.extra.json"),
  getJson("rarities.json"),
  getJson("sets.json"),
]);

const extraByKey = new Map(extra.map((c) => [`${c.set}-${c.number}`, c]));

const setList = Object.entries(setsBySeries).flatMap(([series, sets]) =>
  sets.map((s) => ({
    code: s.code,
    series,
    name: s.name.en ?? s.code,
    releaseDate: s.releaseDate ?? null,
  })),
);
const setByCode = new Map(setList.map((s) => [s.code, s]));

const GROUP_ORDER = { Diamond: 1, Star: 2, Shiny: 3, Crown: 4, Anomaly: 5 };

function rankOf(rarity) {
  return GROUP_ORDER[rarity.group] * 10 + (rarity.count ?? 0);
}

// Diamond cards up to 4 diamonds can be shared; tradability comes from the dataset.
const rows = [];
for (const card of cards) {
  const rarity = rarities[card.rarity];
  if (!rarity) continue;
  const detailed = extraByKey.get(`${card.set}-${card.number}`);
  const name = card.name;
  const type = detailed?.type ?? "pokemon";
  const isTrainer = type !== "pokemon" && type !== "energy";
  const kind = /\sex$/i.test(name) ? "ex" : isTrainer ? "trainer" : "other";

  // Only keep what the tracker needs: every ex card, every trainer, and all diamond cards.
  if (kind === "other" && rarity.group !== "Diamond") continue;

  const set = setByCode.get(card.set);
  rows.push({
    id: `${card.set}-${card.number}`,
    setCode: card.set,
    setName: set?.name ?? card.set,
    number: Number(card.number),
    name,
    rarityCode: card.rarity,
    rarityLabel: rarity.label,
    rarityGroup: rarity.group,
    rarityRank: rarity.count ?? 0,
    rarityScore: rankOf(rarity),
    kind,
    // Share gratis: maksimal 4◇ atau 1★ (lihat isShareable di lib/cards.ts).
    shareable:
      (rarity.group === "Diamond" && (rarity.count ?? 0) <= 4) ||
      (rarity.group === "Star" && (rarity.count ?? 0) <= 1),
    tradable: rarity.tradeable === true,
    element: detailed?.element ?? null,
    imageUrl: `${IMAGE_BASE}/${card.set}/${card.number}.webp`,
  });
}

rows.sort((a, b) => a.setCode.localeCompare(b.setCode) || a.number - b.number);

const catalog = {
  source: `${BASE}/cards.json`,
  generatedAt: new Date().toISOString(),
  sets: setList,
  cards: rows,
};

await mkdir(join(root, "data"), { recursive: true });
await writeFile(join(root, "data", "catalog.json"), `${JSON.stringify(catalog)}\n`, "utf8");

const counts = rows.reduce((acc, c) => ({ ...acc, [c.kind]: (acc[c.kind] ?? 0) + 1 }), {});
console.log(
  `Wrote ${rows.length} cards (${JSON.stringify(counts)}) across ${setList.length} sets to data/catalog.json`,
);
