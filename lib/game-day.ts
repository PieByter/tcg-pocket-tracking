import type { AppSettings } from "./settings";
import { intlLocale, type Locale, type Translate } from "./i18n";

type LocalParts = { year: number; month: number; day: number; hour: number; minute: number };

function localParts(date: Date, timeZone: string): LocalParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // Sebagian locale mengembalikan "24" untuk tengah malam.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
  };
}

export function toDayKey(year: number, month: number, day: number): string {
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.toISOString().slice(0, 10);
}

export function shiftDay(dayKey: string, days: number): string {
  const date = new Date(`${dayKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Hari reset game: sebelum jam reset, masih dihitung hari sebelumnya. */
export function gameDayKey(now: Date, settings: Pick<AppSettings, "resetHour" | "timeZone">): string {
  const local = localParts(now, settings.timeZone);
  const beforeReset = local.hour * 60 + local.minute < settings.resetHour * 60;
  return shiftDay(toDayKey(local.year, local.month, local.day), beforeReset ? -1 : 0);
}

export function minutesUntilReset(
  now: Date,
  settings: Pick<AppSettings, "resetHour" | "timeZone">,
): number {
  const local = localParts(now, settings.timeZone);
  const nowMinutes = local.hour * 60 + local.minute;
  const resetMinutes = settings.resetHour * 60;
  return (resetMinutes - nowMinutes + 24 * 60) % (24 * 60);
}

export function formatDayKey(dayKey: string, locale: Locale): string {
  const date = new Date(`${dayKey}T00:00:00Z`);
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

export function relativeDayLabel(
  dayKey: string,
  today: string,
  locale: Locale,
  t: Translate,
): string {
  if (dayKey === today) return t("day.today");
  if (dayKey === shiftDay(today, 1)) return t("day.tomorrow");
  return formatDayKey(dayKey, locale);
}
