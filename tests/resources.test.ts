import { describe, expect, it } from "vitest";
import { estimateResources, staminaRegenPerDay } from "@/lib/resources";

const settings = { tradeStaminaRegenHours: 24, maxTradeStamina: 10 };
const updatedAt = new Date("2026-11-04T00:00:00Z");

const account = { tradeStamina: 2, shinedust: 12_000, resourcesUpdatedAt: updatedAt };

describe("estimateResources", () => {
  it("mengembalikan nilai tersimpan bila belum lewat siklus regen", () => {
    const result = estimateResources(account, new Date("2026-11-04T23:00:00Z"), settings);
    expect(result.stamina).toBe(2);
    expect(result.regenSinceUpdate).toBe(0);
    expect(result.hoursToNextStamina).toBe(1);
    expect(result.shinedust).toBe(12_000);
  });

  it("menambah 1 stamina setiap 24 jam", () => {
    const result = estimateResources(account, new Date("2026-11-05T00:00:00Z"), settings);
    expect(result.stamina).toBe(3);
    expect(result.regenSinceUpdate).toBe(1);
    expect(result.hoursToNextStamina).toBe(24);
  });

  it("membatasi estimasi pada maxTradeStamina", () => {
    const result = estimateResources(account, new Date("2026-11-20T00:00:00Z"), settings);
    expect(result.stamina).toBe(10);
    expect(result.hoursToNextStamina).toBeNull();
  });

  it("menghormati jam regen yang berbeda", () => {
    const fast = { tradeStaminaRegenHours: 12, maxTradeStamina: 10 };
    const result = estimateResources(account, new Date("2026-11-04T12:00:00Z"), fast);
    expect(result.stamina).toBe(3);
    expect(staminaRegenPerDay(fast)).toBe(2);
  });

  it("tidak pernah negatif walau waktu mundur", () => {
    const result = estimateResources(account, new Date("2026-11-03T00:00:00Z"), settings);
    expect(result.stamina).toBe(2);
    expect(result.regenSinceUpdate).toBe(0);
  });
});
