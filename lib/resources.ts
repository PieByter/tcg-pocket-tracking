import type { Account } from "@/db/schema";
import type { AppSettings } from "./settings";

export type ResourceSettings = Pick<AppSettings, "tradeStaminaRegenHours" | "maxTradeStamina">;

export type ResourceState = {
  /** Estimasi stamina saat ini (stored + regen, dibatasi max). */
  stamina: number;
  storedStamina: number;
  regenSinceUpdate: number;
  /** Jam menuju stamina berikutnya; null bila sudah mentok max. */
  hoursToNextStamina: number | null;
  shinedust: number;
  updatedAt: Date;
};

const HOUR_MS = 3_600_000;

export function estimateResources(
  account: Pick<Account, "tradeStamina" | "shinedust" | "resourcesUpdatedAt">,
  now: Date,
  settings: ResourceSettings,
): ResourceState {
  const regenHours = Math.max(1, settings.tradeStaminaRegenHours);
  const maxStamina = Math.max(1, settings.maxTradeStamina);
  const updatedAt = new Date(account.resourcesUpdatedAt);
  const elapsedMs = Math.max(0, now.getTime() - updatedAt.getTime());
  const regen = Math.floor(elapsedMs / (regenHours * HOUR_MS));
  const stamina = Math.min(maxStamina, Math.max(0, account.tradeStamina) + regen);
  const intoCycleMs = elapsedMs % (regenHours * HOUR_MS);

  return {
    stamina,
    storedStamina: account.tradeStamina,
    regenSinceUpdate: Math.max(0, stamina - account.tradeStamina),
    hoursToNextStamina:
      stamina >= maxStamina ? null : Math.max(0, Math.ceil((regenHours * HOUR_MS - intoCycleMs) / HOUR_MS)),
    shinedust: Math.max(0, account.shinedust),
    updatedAt,
  };
}

/** Stamina tambahan setelah `days` hari penuh, mengikuti jam regen. */
export function staminaRegenPerDay(settings: ResourceSettings): number {
  return Math.floor(24 / Math.max(1, settings.tradeStaminaRegenHours));
}
