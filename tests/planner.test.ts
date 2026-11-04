import { describe, expect, it } from "vitest";
import { buildPlan } from "@/lib/planner";
import { account, card, cardMap, holdings, settings } from "./fixtures";

const sabrina = card("A1-200", {
  name: "Sabrina",
  rarityCode: "U",
  rarityLabel: "Uncommon",
  rarityRank: 2,
  rarityScore: 12,
  kind: "trainer",
});
const pikachu = card("A1-100", { name: "Pikachu ex" });
const mewtwo = card("A1-101", { name: "Mewtwo ex" });
const charizard = card("A1-102", { name: "Charizard ex" });
const cards = cardMap([sabrina, pikachu, mewtwo, charizard]);

const TODAY = "2026-11-04";

describe("buildPlan", () => {
  it("mengalokasikan share dan menghormati 1 penerimaan per akun per hari", () => {
    const accounts = [account("a", { minEx: 0 }), account("b", { minEx: 0 }), account("c", { minEx: 0 })];
    const plan = buildPlan({
      accounts,
      cards,
      holdings: holdings({
        a: { "A1-200": { qty: 6, targetQty: 2 } },
        b: { "A1-200": { qty: 0, targetQty: 2 } },
        c: { "A1-200": { qty: 0, targetQty: 2 } },
      }),
      settings,
      today: TODAY,
    });

    expect(plan.totalSlots).toBe(4);
    expect(plan.daysUsed).toBe(2);
    expect(plan.feasible).toBe(true);

    const day0 = plan.slots.filter((slot) => slot.day === TODAY);
    expect(day0).toHaveLength(2);
    // Satu penerimaan per akun di hari yang sama.
    expect(new Set(day0.map((slot) => slot.to.id)).size).toBe(2);
    // Satu kiriman per pasangan per hari.
    expect(new Set(day0.map((slot) => `${slot.from.id}|${slot.to.id}`)).size).toBe(2);
  });

  it("menghormati kuota yang sudah terpakai hari ini", () => {
    const accounts = [account("a", { minEx: 0 }), account("b", { minEx: 0 })];
    const plan = buildPlan({
      accounts,
      cards,
      holdings: holdings({
        a: { "A1-200": { qty: 5, targetQty: 2 } },
        b: { "A1-200": { qty: 0, targetQty: 2 } },
      }),
      settings,
      today: TODAY,
      transfers: [
        {
          method: "share",
          fromAccountId: "a",
          toAccountId: "b",
          gameDay: TODAY,
          status: "confirmed",
        },
      ],
    });

    expect(plan.slots.every((slot) => slot.day !== TODAY)).toBe(true);
    expect(plan.slots[0]?.day).toBe("2026-11-05");
  });

  it("mengutamakan defisit ex sebelum trainer", () => {
    const accounts = [account("a"), account("b")];
    const plan = buildPlan({
      accounts,
      cards,
      holdings: holdings({
        a: {
          "A1-200": { qty: 4, targetQty: 2 },
          "A1-100": { qty: 1, targetQty: 1 },
          "A1-101": { qty: 1, targetQty: 1 },
          "A1-102": { qty: 1, targetQty: 1 },
        },
        b: {
          "A1-200": { qty: 0, targetQty: 2 },
        },
      }),
      settings,
      today: TODAY,
    });

    expect(plan.slots[0].card.kind).toBe("ex");
  });

  it("tidak membuat jadwal yang memakai stok yang sama dua kali", () => {
    const accounts = [account("a", { minEx: 0 }), account("b", { minEx: 0 })];
    const plan = buildPlan({
      accounts,
      cards,
      holdings: holdings({
        a: { "A1-200": { qty: 3, targetQty: 2 } },
        b: { "A1-200": { qty: 0, targetQty: 5 } },
      }),
      settings,
      today: TODAY,
    });

    expect(plan.slots).toHaveLength(1);
    expect(plan.remaining[1].trainerDeficit).toBe(4);
    expect(plan.feasible).toBe(false);
  });

  it("menghormati transfer planned dan tidak menjadwalkannya dua kali", () => {
    const accounts = [account("a", { minEx: 0 }), account("b", { minEx: 0 }), account("c", { minEx: 0 })];
    const plan = buildPlan({
      accounts,
      cards,
      holdings: holdings({
        a: { "A1-200": { qty: 6, targetQty: 2 } },
        b: { "A1-200": { qty: 0, targetQty: 2 } },
        c: { "A1-200": { qty: 0, targetQty: 2 } },
      }),
      settings,
      today: TODAY,
      transfers: [
        {
          method: "share",
          fromAccountId: "a",
          toAccountId: "b",
          gameDay: null,
          plannedDay: "2026-11-05",
          status: "planned",
          cardOutId: "A1-200",
          cardInId: null,
        },
      ],
    });

    // Slot besok untuk b sudah dipesan transfer planned.
    expect(plan.slots.some((slot) => slot.day === "2026-11-05" && slot.to.id === "b")).toBe(false);
    // Stok yang sudah dijanjikan tidak dipakai lagi: total 4 kartu (1 planned + 3 slot).
    expect(plan.slots.filter((slot) => slot.card.id === "A1-200")).toHaveLength(3);
    expect(plan.feasible).toBe(true);
  });

  it("tidak menjadwalkan kartu yang tidak bisa dipindahkan", () => {
    const crown = card("A1-900", {
      name: "Crown Pikachu",
      rarityCode: "UR",
      rarityLabel: "Crown Rare",
      rarityGroup: "Crown",
      rarityRank: 1,
      rarityScore: 41,
      shareable: false,
      tradable: false,
    });
    const accounts = [account("a"), account("b")];
    const plan = buildPlan({
      accounts,
      cards: cardMap([...cards.values(), crown]),
      holdings: holdings({
        a: { "A1-900": { qty: 3, targetQty: 1 } },
        b: {},
      }),
      settings,
      today: TODAY,
    });

    expect(plan.slots).toHaveLength(0);
  });

  it("memberi metode trade untuk kartu 2★ dan menukar balik duplikat", () => {
    const star = card("A1-300", {
      name: "Mewtwo ex",
      rarityCode: "SR",
      rarityLabel: "Super Rare",
      rarityGroup: "Star",
      rarityRank: 2,
      rarityScore: 22,
      shareable: false,
    });
    const starDup = card("A1-400", {
      name: "Gengar ex",
      rarityCode: "SR",
      rarityLabel: "Super Rare",
      rarityGroup: "Star",
      rarityRank: 2,
      rarityScore: 22,
      shareable: false,
    });
    const accounts = [account("a"), account("b")];
    const plan = buildPlan({
      accounts,
      cards: cardMap([star, starDup]),
      holdings: holdings({
        a: { "A1-300": { qty: 2, targetQty: 1 } },
        b: {
          "A1-300": { qty: 0, targetQty: 1 },
          "A1-400": { qty: 2, targetQty: 1 },
        },
      }),
      settings,
      today: TODAY,
    });

    const trade = plan.slots.find((slot) => slot.method === "trade");
    expect(trade).toBeDefined();
    const pair = [trade?.card.id, trade?.tradeBack?.id].sort();
    expect(pair).toEqual(["A1-300", "A1-400"]);
  });

  it("tidak menjadwalkan trade tanpa stamina, lalu memakainya setelah regen harian", () => {
    const star = card("A1-300", {
      name: "Mewtwo ex",
      rarityCode: "SR",
      rarityLabel: "Super Rare",
      rarityGroup: "Star",
      rarityRank: 2,
      rarityScore: 22,
      shareable: false,
    });
    const starDup = card("A1-400", {
      name: "Gengar ex",
      rarityCode: "SR",
      rarityLabel: "Super Rare",
      rarityGroup: "Star",
      rarityRank: 2,
      rarityScore: 22,
      shareable: false,
    });
    const now = new Date("2026-11-04T00:00:00Z");
    const accounts = [
      account("a", { minEx: 0, tradeStamina: 0, shinedust: 50_000, resourcesUpdatedAt: now }),
      account("b", { minEx: 2, tradeStamina: 0, shinedust: 50_000, resourcesUpdatedAt: now }),
    ];

    const plan = buildPlan({
      accounts,
      cards: cardMap([star, starDup]),
      holdings: holdings({
        a: { "A1-300": { qty: 2, targetQty: 1 } },
        b: {
          "A1-300": { qty: 0, targetQty: 1 },
          "A1-400": { qty: 2, targetQty: 1 },
        },
      }),
      settings,
      today: TODAY,
      now,
    });

    expect(plan.slots).toHaveLength(1);
    expect(plan.slots[0].day).toBe("2026-11-05");
    expect(plan.slots[0].method).toBe("trade");
  });
});
