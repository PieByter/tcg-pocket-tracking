import { describe, expect, it } from "vitest";
import { buildCandidates, computeUsage, quotaFor } from "@/lib/domain";
import { account, card, cardMap, holdings, settings, type AccountHoldings } from "./fixtures";

const ex1 = card("A1-100", { name: "Pikachu ex" });
const ex2 = card("A1-101", { name: "Charizard ex" });
const ex3 = card("A1-102", { name: "Mewtwo ex" });
const trainer = card("A1-200", {
  name: "Sabrina",
  rarityCode: "U",
  rarityLabel: "Uncommon",
  rarityRank: 2,
  rarityScore: 12,
  kind: "trainer",
});
const star = card("A1-300", {
  name: "Mewtwo ex",
  rarityCode: "SR",
  rarityLabel: "Super Rare",
  rarityGroup: "Star",
  rarityRank: 2,
  rarityScore: 22,
  shareable: false,
});
const immersive = card("A1-301", {
  name: "Pikachu ex",
  rarityCode: "IM",
  rarityLabel: "Immersive Rare",
  rarityGroup: "Star",
  rarityRank: 3,
  rarityScore: 23,
  shareable: false,
  tradable: false,
  kind: "ex",
});

const cards = cardMap([ex1, ex2, ex3, trainer, star, immersive]);

const emptyUsage = computeUsage([], "2026-11-04");

function candidatesFor(
  fromHoldings: AccountHoldings,
  toHoldings: AccountHoldings,
  overrides: { fromMinEx?: number; quotas?: Partial<ReturnType<typeof quotaFor>> } = {},
) {
  const from = account("from", { name: "Pemberi", minEx: overrides.fromMinEx ?? 2 });
  const to = account("to", { name: "Penerima" });
  const baseQuota = quotaFor(from.id, to.id, emptyUsage, settings);
  return buildCandidates({
    fromAccount: from,
    toAccount: to,
    cards,
    holdings: holdings({ from: fromHoldings, to: toHoldings }),
    settings,
    quota: { ...baseQuota, ...overrides.quotas },
  });
}

describe("buildCandidates", () => {
  it("menawarkan kartu yang belum dimiliki penerima dan surplus di pemberi", () => {
    const result = candidatesFor(
      { "A1-200": { qty: 3, targetQty: 2 } },
      {},
    );
    expect(result).toHaveLength(1);
    expect(result[0].card.id).toBe("A1-200");
    expect(result[0].method).toBe("share");
    expect(result[0].spare).toBe(1);
    expect(result[0].allowedNow).toBe(true);
  });

  it("tidak menawarkan kartu yang sudah dimiliki penerima", () => {
    const result = candidatesFor(
      { "A1-200": { qty: 3, targetQty: 2 } },
      { "A1-200": { qty: 1, targetQty: 2 } },
    );
    expect(result).toHaveLength(0);
  });

  it("mengizinkan ex tunggal selama minimal ex tetap terpenuhi", () => {
    const result = candidatesFor(
      {
        "A1-100": { qty: 1, targetQty: 1 },
        "A1-101": { qty: 1, targetQty: 1 },
        "A1-102": { qty: 1, targetQty: 1 },
      },
      {},
      { fromMinEx: 2 },
    );
    const ids = result.map((candidate) => candidate.card.id);
    expect(ids).toContain("A1-100");
    expect(result.every((candidate) => candidate.allowedNow)).toBe(true);
  });

  it("menolak donor ex yang akan jatuh di bawah minimal ex", () => {
    const result = candidatesFor(
      {
        "A1-100": { qty: 1, targetQty: 1 },
        "A1-101": { qty: 1, targetQty: 1 },
      },
      {},
      { fromMinEx: 2 },
    );
    expect(result).toHaveLength(0);
  });

  it("tidak pernah menawarkan kartu yang tidak bisa dipindahkan", () => {
    const result = candidatesFor(
      {
        "A1-301": { qty: 5, targetQty: 1 },
        "A1-100": { qty: 1, targetQty: 1 },
        "A1-101": { qty: 1, targetQty: 1 },
        "A1-102": { qty: 1, targetQty: 1 },
      },
      {},
    );
    expect(result.map((candidate) => candidate.card.id)).not.toContain("A1-301");
  });

  it("memberi metode trade untuk kartu 2★ dan menyarankan duplikat rarity sama", () => {
    const result = candidatesFor(
      {
        "A1-300": { qty: 2, targetQty: 1 },
        "A1-100": { qty: 1, targetQty: 1 },
        "A1-101": { qty: 1, targetQty: 1 },
      },
      { "A1-400": { qty: 2, targetQty: 1 } },
    );
    const trade = result.find((candidate) => candidate.card.id === "A1-300");
    expect(trade).toBeDefined();
    expect(trade?.method).toBe("trade");
  });

  it("menandai kandidat sebagai blocked saat kuota kirim habis", () => {
    const result = candidatesFor({ "A1-200": { qty: 3, targetQty: 2 } }, {}, {
      quotas: { pairSendRemaining: 0 },
    });
    expect(result[0].allowedNow).toBe(false);
    expect(result[0].blockedReason).toContain("kuota kirim");
  });

  it("mengurutkan ex lebih dulu daripada trainer", () => {
    const result = candidatesFor(
      {
        "A1-100": { qty: 1, targetQty: 1 },
        "A1-101": { qty: 1, targetQty: 1 },
        "A1-102": { qty: 1, targetQty: 1 },
        "A1-200": { qty: 3, targetQty: 2 },
      },
      {},
    );
    expect(result[0].card.kind).toBe("ex");
  });
});

describe("computeUsage", () => {
  const transfers = [
    {
      method: "share" as const,
      fromAccountId: "from",
      toAccountId: "to",
      gameDay: "2026-11-04",
      status: "sent" as const,
    },
    {
      method: "trade" as const,
      fromAccountId: "from",
      toAccountId: "other",
      gameDay: "2026-11-04",
      status: "confirmed" as const,
    },
    {
      method: "share" as const,
      fromAccountId: "from",
      toAccountId: "to",
      gameDay: "2026-11-03",
      status: "confirmed" as const,
    },
    {
      method: "share" as const,
      fromAccountId: "from",
      toAccountId: "to",
      gameDay: "2026-11-04",
      status: "cancelled" as const,
    },
  ];

  it("menghitung hanya transfer sent/confirmed pada game day yang sama", () => {
    const usage = computeUsage(transfers, "2026-11-04");
    expect(usage.receivedShare.get("to")).toBe(1);
    expect(usage.sharePairs.get("from|to")).toBe(1);
    expect(usage.tradesPerAccount.get("from")).toBe(1);
    expect(usage.tradesPerAccount.get("other")).toBe(1);
  });

  it("memblokir pasangan trade pada hari yang sama dan membuka besoknya", () => {
    const sameDay = computeUsage(transfers, "2026-11-04");
    expect(sameDay.lastTradePerPair.get("from|other")).toBe("2026-11-04");
    expect(quotaFor("from", "other", sameDay, settings).tradePairBlocked).toBe(true);

    const nextDay = computeUsage(transfers, "2026-11-05");
    expect(quotaFor("from", "other", nextDay, settings).tradePairBlocked).toBe(false);
  });
});
