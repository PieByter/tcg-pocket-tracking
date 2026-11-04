import { en, type MessageKey } from "./en";
import { id } from "./id";

export type Locale = "en" | "id";

/** Default UI language is English; Bahasa Indonesia is opt-in. */
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "pocketledger_locale";

export const LOCALES: { value: Locale; labelKey: MessageKey }[] = [
  { value: "en", labelKey: "lang.en" },
  { value: "id", labelKey: "lang.id" },
];

export type MessageParams = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: MessageParams) => string;
export type I18n = { locale: Locale; t: Translate };

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, id };

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "id";
}

export function createI18n(locale: Locale): I18n {
  const dictionary = dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
  const t: Translate = (key, params) => {
    const template = dictionary[key] ?? dictionaries[DEFAULT_LOCALE][key] ?? key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      params[name] === undefined ? match : String(params[name]),
    );
  };
  return { locale, t };
}

/** BCP-47 tag used for numbers, dates, and exemptions. */
export function intlLocale(locale: Locale): string {
  return locale === "id" ? "id-ID" : "en-GB";
}

/** Terjemahkan key untuk pemakaian non-React (mis. metadata). */
export function translate(locale: Locale, key: MessageKey, params?: MessageParams): string {
  return createI18n(locale).t(key, params);
}

export { en, id };
export type { MessageKey };
