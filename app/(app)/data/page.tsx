import { ImportPanel } from "@/components/import-panel";
import { Icon, type IconName } from "@/components/icon";
import { PageHeader, SectionHeading, StatCard } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { loadDataStats } from "@/lib/queries";
import { requireUser } from "@/lib/auth";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("data.metaTitle") };
}

const EXPORTS: {
  href: string;
  labelKey: "data.export.json" | "data.export.collection" | "data.export.transfers";
  hintKey: "data.export.jsonHint" | "data.export.collectionHint" | "data.export.transfersHint";
  icon: IconName;
}[] = [
  {
    href: "/api/export/json",
    labelKey: "data.export.json",
    hintKey: "data.export.jsonHint",
    icon: "database",
  },
  {
    href: "/api/export/collection",
    labelKey: "data.export.collection",
    hintKey: "data.export.collectionHint",
    icon: "matrix",
  },
  {
    href: "/api/export/transfers",
    labelKey: "data.export.transfers",
    hintKey: "data.export.transfersHint",
    icon: "repeat",
  },
];

export default async function DataPage() {
  const user = await requireUser();
  const [{ locale, t }, stats] = await Promise.all([getI18n(), loadDataStats(user.id)]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("data.eyebrow")}
        title={t("data.title")}
        description={t("data.description")}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label={t("data.stats.accounts")}
          value={formatNumber(stats.accounts, locale)}
          icon="dashboard"
        />
        <StatCard
          label={t("data.stats.holdings")}
          value={formatNumber(stats.holdings, locale)}
          tone="secondary"
          icon="matrix"
        />
        <StatCard
          label={t("data.stats.transfers")}
          value={formatNumber(stats.transfers, locale)}
          tone="tertiary"
          icon="repeat"
        />
      </div>

      <section>
        <SectionHeading title={t("data.export.title")} subtitle={t("data.export.subtitle")} />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {EXPORTS.map((item) => (
            <div key={item.href} className="panel flex flex-col gap-2 p-3">
              <p className="flex items-center gap-2 font-display text-sm text-on-surface">
                <span className="grid h-7 w-7 place-items-center rounded-md border border-primary/25 bg-primary/10 text-primary">
                  <Icon name={item.icon} className="h-4 w-4" />
                </span>
                {t(item.labelKey)}
              </p>
              <p className="text-body-sm text-on-surface-variant">{t(item.hintKey)}</p>
              <a href={item.href} download className="btn-secondary mt-auto w-fit">
                <Icon name="download" className="h-4 w-4" />
                {t("data.export.download")}
              </a>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading title={t("data.import.title")} subtitle={t("data.import.subtitle")} />
        <ImportPanel />
      </section>

      <p className="flex items-start gap-2 text-xs text-outline">
        <Icon name="shield" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {t("data.import.privacy")}
      </p>
    </div>
  );
}
