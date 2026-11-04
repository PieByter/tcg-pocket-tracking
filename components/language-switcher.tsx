import { changeLocale } from "@/app/actions";
import { LOCALES, type Locale, type Translate } from "@/lib/i18n";

export function LanguageSwitcher({
  locale,
  t,
  compact = false,
}: {
  locale: Locale;
  t: Translate;
  compact?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={t("common.language")}
      className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5"
    >
      {LOCALES.map((item) => {
        const active = item.value === locale;
        return (
          <form key={item.value} action={changeLocale}>
            <input type="hidden" name="locale" value={item.value} />
            <button
              type="submit"
              aria-pressed={active}
              className={`rounded-md px-2 py-1 font-mono text-label-sm uppercase tracking-wider transition ${
                active
                  ? "bg-primary/15 text-primary"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {compact ? item.value.toUpperCase() : t(item.labelKey)}
            </button>
          </form>
        );
      })}
    </div>
  );
}
