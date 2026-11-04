import "server-only";
import { cookies } from "next/headers";
import {
  createI18n,
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  type I18n,
  type Locale,
} from "./index";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getI18n(): Promise<I18n> {
  return createI18n(await getLocale());
}

export { LOCALE_COOKIE };
