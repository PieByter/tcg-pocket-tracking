import { intlLocale, type Locale } from "./i18n";

export function formatDateTime(
  value: Date | string | null,
  timeZone = "Asia/Jakarta",
  locale: Locale = "en",
): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(date);
}

export function shortId(id: string): string {
  return `#TX-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

export function accountShortName(name: string): string {
  return name.replace(/^Akun \d+:\s*/, "");
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
}
