import { describe, expect, it } from "vitest";
import { gameDayKey, minutesUntilReset, shiftDay, toDayKey } from "@/lib/game-day";

const settings = { resetHour: 4, timeZone: "Asia/Jakarta" };

describe("gameDayKey", () => {
  it("memakai hari sebelumnya sebelum jam reset", () => {
    // 03:30 WIB = 20:30 UTC hari sebelumnya.
    const now = new Date("2026-11-03T20:30:00Z");
    expect(gameDayKey(now, settings)).toBe("2026-11-03");
  });

  it("memakai hari berjalan setelah jam reset", () => {
    // 05:00 WIB = 22:00 UTC hari sebelumnya.
    const now = new Date("2026-11-03T22:00:00Z");
    expect(gameDayKey(now, settings)).toBe("2026-11-04");
  });

  it("menghormati zona waktu berbeda", () => {
    // 21:00 UTC = 04:00 WIB (tepat jam reset) dan 13:00 di Los Angeles.
    const now = new Date("2026-11-03T21:00:00Z");
    expect(gameDayKey(now, { resetHour: 4, timeZone: "Asia/Jakarta" })).toBe("2026-11-04");
    expect(gameDayKey(now, { resetHour: 4, timeZone: "America/Los_Angeles" })).toBe("2026-11-03");
  });
});

describe("helper tanggal", () => {
  it("shiftDay melintasi batas bulan", () => {
    expect(shiftDay("2026-11-30", 1)).toBe("2026-12-01");
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("toDayKey memakai padding", () => {
    expect(toDayKey(2026, 1, 5)).toBe("2026-01-05");
  });

  it("minutesUntilReset menghitung sisa ke jam reset", () => {
    // 02:00 WIB -> 2 jam menuju 04:00.
    const now = new Date("2026-11-03T19:00:00Z");
    expect(minutesUntilReset(now, settings)).toBe(120);
  });
});
