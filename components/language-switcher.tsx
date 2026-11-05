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
      className="inline-flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/5 p-0.5"
    >
      <form action={changeLocale} className="contents">
        {LOCALES.map((item) => {
          const active = item.value === locale;
          return (
            <button
              key={item.value}
              type="submit"
              name="locale"
              value={item.value}
              aria-pressed={active}
              className={`inline-flex h-6 items-center justify-center rounded-md px-2 font-mono text-label-sm uppercase tracking-wider transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                active
                  ? "bg-primary/15 text-primary"
                  : "text-outline hover:bg-white/5 hover:text-on-surface"
              }`}
            >
              {compact ? item.value.toUpperCase() : t(item.labelKey)}
            </button>
          );
        })}
      </form>
    </div>
  );
}
