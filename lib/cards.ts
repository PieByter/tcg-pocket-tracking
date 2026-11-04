import type { Card } from "@/db/schema";
import type { AppSettings } from "./settings";

export const RARITY_GROUPS = ["Diamond", "Star", "Shiny", "Crown", "Anomaly"] as const;

export type RarityGroup = (typeof RARITY_GROUPS)[number];

export function rarityGlyph(card: Pick<Card, "rarityGroup" | "rarityRank">): string {
  switch (card.rarityGroup) {
    case "Diamond":
      return "◇";
    case "Star":
      return "★";
    case "Shiny":
      return "✦";
    case "Crown":
      return "♛";
    default:
      return "◈";
  }
}

/** Label ringkas untuk chip: "4◇", "2★", "♛". */
export function rarityShort(card: Pick<Card, "rarityGroup" | "rarityRank">): string {
  if (card.rarityGroup === "Crown") return rarityGlyph(card);
  return `${Math.max(1, card.rarityRank)}${rarityGlyph(card)}`;
}

export function rarityLabel(card: Pick<Card, "rarityGroup" | "rarityRank" | "rarityLabel">): string {
  return `${rarityGlyph(card).repeat(card.rarityGroup === "Crown" ? 1 : Math.max(1, card.rarityRank))} ${
    card.rarityLabel
  }`;
}

export function rarityChipClass(card: Pick<Card, "rarityGroup">): string {
  switch (card.rarityGroup) {
    case "Diamond":
      return "border-sky-400/30 bg-sky-400/10 text-sky-300";
    case "Star":
      return "border-purple-400/30 bg-purple-400/10 text-purple-300";
    case "Shiny":
      return "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";
    case "Crown":
      return "border-amber-400/40 bg-amber-400/15 text-amber-300";
    default:
      return "border-outline-variant bg-surface-container-high text-on-surface-variant";
  }
}

export function isDefaultTracked(card: Pick<Card, "kind" | "rarityGroup" | "rarityRank">): boolean {
  if (card.kind === "ex") return true;
  if (card.kind === "trainer") return card.rarityGroup === "Diamond" && card.rarityRank <= 3;
  return false;
}

export function defaultTarget(
  card: Pick<Card, "kind">,
  settings: Pick<AppSettings, "exTarget" | "trainerTarget">,
): number {
  if (card.kind === "ex") return settings.exTarget;
  if (card.kind === "trainer") return settings.trainerTarget;
  return 1;
}

/** Kunci keunikan ex: satu alt-art dari kartu yang sama tidak menambah jumlah ex. */
export function exIdentity(card: Pick<Card, "id" | "name">, mode: AppSettings["exCountMode"]): string {
  return mode === "name" ? card.name.trim().toLowerCase() : card.id;
}

export function transferMethod(card: Pick<Card, "shareable" | "tradable">): "share" | "trade" | null {
  if (card.shareable) return "share";
  if (card.tradable) return "trade";
  return null;
}

export function tradeCost(
  card: Pick<Card, "rarityCode">,
  costs: AppSettings["tradeCosts"],
): number {
  return costs[card.rarityCode] ?? 0;
}

export function cardTitle(card: Pick<Card, "name" | "setCode" | "number">): string {
  return `${card.name} · ${card.setCode}-${String(card.number).padStart(3, "0")}`;
}
