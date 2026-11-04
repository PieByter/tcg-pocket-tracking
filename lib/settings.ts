export type AppSettings = {
  /** Kartu yang boleh diterima satu akun per hari lewat Share. */
  shareReceivePerDay: number;
  /** Kiriman Share dari satu akun ke akun lain per hari. */
  shareSendPerPairPerDay: number;
  /** Batas trade per akun per hari. */
  tradePerAccountPerDay: number;
  /** Jeda hari sebelum pasangan akun yang sama boleh trade lagi. */
  tradePairCooldownDays: number;
  /** Jam reset harian (0-23) pada zona waktu di bawah. */
  resetHour: number;
  timeZone: string;
  /** Target kartu Trainer default saat holding baru dibuat. */
  trainerTarget: number;
  /** Target kartu ex default saat holding baru dibuat. */
  exTarget: number;
  /** ex dihitung unik per nama kartu atau per cetakan. */
  exCountMode: "name" | "print";
  plannerHorizonDays: number;
  /** Biaya Shinedust per rarity code (informasi di UI Trade). */
  tradeCosts: Record<string, number>;
};

export const DEFAULT_SETTINGS: AppSettings = {
  shareReceivePerDay: 1,
  shareSendPerPairPerDay: 1,
  tradePerAccountPerDay: 5,
  tradePairCooldownDays: 1,
  resetHour: 4,
  timeZone: "Asia/Jakarta",
  trainerTarget: 2,
  exTarget: 1,
  exCountMode: "name",
  plannerHorizonDays: 14,
  tradeCosts: {
    C: 0,
    U: 0,
    R: 1200,
    RR: 5000,
    AR: 4000,
    SR: 25000,
    SAR: 25000,
    S: 10000,
    SSR: 30000,
  },
};

export const CONFIG_KEYS: Record<keyof AppSettings, string> = {
  shareReceivePerDay: "share.receive_per_day",
  shareSendPerPairPerDay: "share.send_per_pair_per_day",
  tradePerAccountPerDay: "trade.per_account_per_day",
  tradePairCooldownDays: "trade.pair_cooldown_days",
  resetHour: "day.reset_hour",
  timeZone: "day.timezone",
  trainerTarget: "holdings.trainer_target",
  exTarget: "holdings.ex_target",
  exCountMode: "holdings.ex_count_mode",
  plannerHorizonDays: "planner.horizon_days",
  tradeCosts: "trade.costs",
};

export function configKey(key: keyof AppSettings): string {
  return CONFIG_KEYS[key];
}

export function serializeSettings(settings: AppSettings): { key: string; value: string }[] {
  return (Object.keys(CONFIG_KEYS) as (keyof AppSettings)[]).map((field) => ({
    key: CONFIG_KEYS[field],
    value: JSON.stringify(settings[field]),
  }));
}

export function parseSettings(rows: { key: string; value: string }[]): AppSettings {
  const stored = new Map(rows.map((row) => [row.key, row.value]));
  const settings: AppSettings = { ...DEFAULT_SETTINGS, tradeCosts: { ...DEFAULT_SETTINGS.tradeCosts } };

  for (const field of Object.keys(CONFIG_KEYS) as (keyof AppSettings)[]) {
    const raw = stored.get(CONFIG_KEYS[field]);
    if (raw === undefined) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    if (field === "tradeCosts") {
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        settings.tradeCosts = Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>)
            .map(([code, cost]) => [code, Number(cost)] as const)
            .filter(([, cost]) => Number.isFinite(cost)),
        );
      }
      continue;
    }
    if (field === "exCountMode") {
      if (parsed === "name" || parsed === "print") settings.exCountMode = parsed;
      continue;
    }
    if (typeof parsed === typeof DEFAULT_SETTINGS[field]) {
      Object.assign(settings, { [field]: parsed });
    }
  }

  return settings;
}
