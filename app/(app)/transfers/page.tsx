import Link from "next/link";
import { Icon } from "@/components/icon";
import { TransferRow } from "@/components/transfer-row";
import { EmptyState, PageHeader, SectionHeading, StatCard } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";
import { loadLedger } from "@/lib/queries";
import { requireUser } from "@/lib/auth";
import type { MessageKey } from "@/lib/i18n";
import type { TransferStatus } from "@/db/schema";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("transfers.metaTitle") };
}

const FILTERS: { value: "all" | TransferStatus; key: MessageKey }[] = [
  { value: "all", key: "transfers.filter.all" },
  { value: "planned", key: "transfer.status.planned" },
  { value: "sent", key: "transfer.status.sent" },
  { value: "confirmed", key: "transfer.status.confirmed" },
  { value: "cancelled", key: "transfer.status.cancelled" },
];

export default async function TransfersPage(props: PageProps<"/transfers">) {
  const user = await requireUser();
  const [searchParams, ledger, { t }] = await Promise.all([
    props.searchParams,
    loadLedger(user.id),
    getI18n(),
  ]);
  const status = (typeof searchParams.status === "string" ? searchParams.status : "all") as
    | "all"
    | TransferStatus;

  const rows = status === "all" ? ledger.transfers : ledger.transfers.filter((row) => row.status === status);
  const counts = {
    planned: ledger.transfers.filter((row) => row.status === "planned").length,
    sent: ledger.transfers.filter((row) => row.status === "sent").length,
    confirmed: ledger.transfers.filter((row) => row.status === "confirmed").length,
    cancelled: ledger.transfers.filter((row) => row.status === "cancelled").length,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("transfers.eyebrow")}
        title={t("transfers.title")}
        description={t("transfers.description")}
        actions={
          <Link href="/matcher" className="btn-primary">
            <Icon name="plus" className="h-4 w-4" />
            {t("transfers.action.new")}
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t("transfer.status.planned")}
          value={counts.planned}
          hint={t("transfers.kpi.planned.hint")}
          tone="secondary"
          icon="clock"
        />
        <StatCard
          label={t("transfer.status.sent")}
          value={counts.sent}
          hint={t("transfers.kpi.sent.hint")}
          tone="primary"
          icon="send"
        />
        <StatCard
          label={t("transfer.status.confirmed")}
          value={counts.confirmed}
          hint={t("transfers.kpi.confirmed.hint")}
          tone="success"
          icon="shield"
        />
        <StatCard
          label={t("transfer.status.cancelled")}
          value={counts.cancelled}
          hint={t("transfers.kpi.cancelled.hint")}
          tone="tertiary"
          icon="x"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((filter) => {
          const active = status === filter.value;
          const href = filter.value === "all" ? "/transfers" : `/transfers?status=${filter.value}`;
          return (
            <Link
              key={filter.value}
              href={href}
              className={`chip ${
                active
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-white/10 bg-white/5 text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {t(filter.key)}
            </Link>
          );
        })}
      </div>

      <section>
        <SectionHeading
          title={t("transfers.list.title")}
          subtitle={t("transfers.list.subtitle")}
          badge={t("transfers.list.badge", { count: rows.length })}
        />
        <div className="panel overflow-hidden">
          {rows.length === 0 ? (
            <EmptyState
              icon="repeat"
              title={t("transfers.empty.title")}
              description={t("transfers.empty.body")}
              action={
                <Link href="/matcher" className="btn-primary">
                  {t("transfers.empty.action")}
                </Link>
              }
            />
          ) : (
            rows.map((transfer) => (
              <TransferRow
                key={transfer.id}
                transfer={transfer}
                timeZone={ledger.settings.timeZone}
              />
            ))
          )}
        </div>
        {ledger.transfers.length >= 200 && (
          <p className="mt-2 text-body-sm text-outline">{t("transfers.archiveNote")}</p>
        )}
      </section>
    </div>
  );
}
