import Link from "next/link";
import { AccountCard, type Recommendation } from "@/components/account-card";
import { EmptyState, PageHeader, SectionHeading, StatCard } from "@/components/ui";
import { Icon } from "@/components/icon";
import { TransferRow } from "@/components/transfer-row";
import { buildCandidates, quotaFor } from "@/lib/domain";
import { getI18n } from "@/lib/i18n/server";
import { loadLedger } from "@/lib/queries";
import { requireUser } from "@/lib/auth";
import { estimateResources } from "@/lib/resources";

function recommendationsFor(ledger: Awaited<ReturnType<typeof loadLedger>>, receiverId: string) {
  const receiver = ledger.accounts.find((account) => account.id === receiverId);
  if (!receiver) return [];
  const list: Recommendation[] = [];

  for (const donor of ledger.accounts) {
    if (donor.id === receiverId) continue;
    const candidates = buildCandidates({
      fromAccount: donor,
      toAccount: receiver,
      cards: ledger.cards,
      holdings: ledger.holdings,
      settings: ledger.settings,
      quota: quotaFor(donor.id, receiverId, ledger.usage, ledger.settings),
      now: new Date(),
    });
    for (const candidate of candidates) {
      if (candidate.card.kind !== "ex") continue;
      list.push({ card: candidate.card, donor, method: candidate.method });
    }
  }

  return list
    .sort((a, b) => Number(a.method === "trade") - Number(b.method === "trade"))
    .slice(0, 4);
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [ledger, { t }] = await Promise.all([loadLedger(user.id), getI18n()]);
  const { summaries, settings, accounts } = ledger;

  const deficitAccounts = summaries.filter(
    (summary) => summary.status === "needs" || summary.status === "critical",
  );
  const untrackedAccounts = summaries.filter((summary) => summary.status === "untracked");
  const criticalAccounts = summaries.filter((summary) => summary.status === "critical");
  const trainerDeficit = summaries.reduce((total, summary) => total + summary.trainerDeficit, 0);
  const shareUsed = [...ledger.usage.receivedShare.values()].reduce((total, value) => total + value, 0);
  const shareCapacity = accounts.length * settings.shareReceivePerDay;
  const tradeUsed = [...ledger.usage.tradesPerAccount.values()].reduce((total, value) => total + value, 0);
  const minEx = accounts.length > 0 ? Math.min(...accounts.map((account) => account.minEx)) : 2;
  const resetTime = `${String(settings.resetHour).padStart(2, "0")}:00`;
  const now = new Date();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t("dash.eyebrow")}
        title={t("dash.title")}
        description={t("dash.description")}
        actions={
          <>
            <Link href="/matcher" className="btn-primary">
              <Icon name="swap" className="h-4 w-4" />
              {t("dash.action.matcher")}
            </Link>
            <Link href="/inventory" className="btn-secondary">
              <Icon name="matrix" className="h-4 w-4" />
              {t("dash.action.quickFix")}
            </Link>
            <Link href="/planner" className="btn-secondary">
              <Icon name="planner" className="h-4 w-4" />
              {t("dash.action.planner")}
            </Link>
          </>
        }
      />

      {ledger.catalogEmpty && (
        <div className="panel-raised flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-sm text-on-surface">{t("dash.catalog.title")}</p>
            <p className="text-body-sm text-on-surface-variant">
              <code className="font-mono text-primary">npm run db:seed</code> — {t("dash.catalog.body")}
            </p>
          </div>
          <Link href="/settings" className="btn-secondary shrink-0">
            {t("dash.catalog.action")}
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("dash.kpi.accounts.label")}
          value={accounts.length}
          hint={t("dash.kpi.accounts.hint")}
          icon="shield"
          tone="primary"
          detail={
            <span>
              <span className="text-primary">
                {t("dash.kpi.accounts.detail", {
                  ok: accounts.length - deficitAccounts.length,
                  needs: deficitAccounts.length,
                })}
              </span>
              {untrackedAccounts.length > 0 && (
                <span className="text-outline">
                  {t("dash.kpi.accounts.untracked", { count: untrackedAccounts.length })}
                </span>
              )}
            </span>
          }
        />
        <StatCard
          label={t("dash.kpi.ex.label")}
          value={deficitAccounts.length}
          hint={t("dash.kpi.ex.hint")}
          icon="alert"
          tone={deficitAccounts.length > 0 ? "secondary" : "success"}
          detail={<span>{t("dash.kpi.ex.detail", { min: minEx })}</span>}
        />
        <StatCard
          label={t("dash.kpi.trainer.label")}
          value={trainerDeficit}
          hint={t("dash.kpi.trainer.hint")}
          icon="matrix"
          tone="tertiary"
          detail={
            <span>
              {t("dash.kpi.trainer.detail", { count: criticalAccounts.length })}
              {criticalAccounts.length > 0 && (
                <span className="text-secondary">
                  {" · "}
                  {criticalAccounts.map((item) => item.account.name.split(":")[0]).join(", ")}
                </span>
              )}
            </span>
          }
        />
        <StatCard
          label={t("dash.kpi.share.label")}
          value={`${Math.max(0, shareCapacity - shareUsed)}/${shareCapacity}`}
          hint={t("dash.kpi.share.hint")}
          icon="clock"
          tone="primary"
          detail={
            <span>
              {t("dash.kpi.share.detail", {
                used: tradeUsed,
                time: resetTime,
                timeZone: settings.timeZone,
              })}
            </span>
          }
        />
      </div>

      <section>
        <SectionHeading
          title={t("dash.radar.title")}
          subtitle={t("dash.radar.subtitle")}
          badge={t("dash.radar.badge", { count: accounts.length })}
          action={
            <div className="flex items-center gap-3 font-mono text-label-sm text-outline">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                {t("dash.radar.legend.ready")}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
                {t("dash.radar.legend.needs")}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                {t("dash.radar.legend.critical")}
              </span>
            </div>
          }
        />
        {summaries.length === 0 ? (
          <EmptyState
            icon="shield"
            title={t("dash.empty.title")}
            description={t("dash.empty.body")}
            action={
              <Link href="/settings" className="btn-primary">
                {t("dash.empty.action")}
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[...summaries]
              .sort(
                (a, b) =>
                  b.exDeficit - a.exDeficit ||
                  Number(a.status === "untracked") - Number(b.status === "untracked") ||
                  a.account.sortOrder - b.account.sortOrder,
              )
              .map((summary) => (
                <AccountCard
                  key={summary.account.id}
                  summary={summary}
                  resources={estimateResources(summary.account, now, settings)}
                  recommendations={
                    summary.status === "needs" || summary.status === "critical"
                      ? recommendationsFor(ledger, summary.account.id)
                      : []
                  }
                />
              ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeading
          title={t("dash.live.title")}
          subtitle={t("dash.live.subtitle")}
          action={
            <div className="flex items-center gap-1.5 font-mono text-label-sm uppercase tracking-wider text-outline">
              <span className="chip border-secondary/30 bg-secondary/10 text-secondary">
                {t("dash.live.planned", {
                  count: ledger.transfers.filter((item) => item.status === "planned").length,
                })}
              </span>
              <span className="chip border-primary/30 bg-primary/10 text-primary">
                {t("dash.live.sent", {
                  count: ledger.transfers.filter((item) => item.status === "sent").length,
                })}
              </span>
              <span className="chip border-success/30 bg-success/10 text-success">
                {t("dash.live.confirmed", {
                  count: ledger.transfers.filter((item) => item.status === "confirmed").length,
                })}
              </span>
            </div>
          }
        />
        <div className="panel overflow-hidden">
          {ledger.transfers.length === 0 ? (
            <EmptyState
              icon="swap"
              title={t("dash.live.emptyTitle")}
              description={t("dash.live.emptyBody")}
              action={
                <Link href="/matcher" className="btn-primary">
                  {t("dash.live.emptyAction")}
                </Link>
              }
            />
          ) : (
            <>
              <div className="hidden border-b border-white/[0.06] bg-surface-container-lowest/60 px-4 py-2 font-mono text-label-sm uppercase tracking-[0.12em] text-outline md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)_auto]">
                <span>{t("dash.live.table.id")}</span>
                <span>{t("dash.live.table.from")}</span>
                <span>{t("dash.live.table.card")}</span>
                <span className="text-right">{t("dash.live.table.to")}</span>
              </div>
              {ledger.transfers.slice(0, 6).map((transfer) => (
                <TransferRow
                  key={transfer.id}
                  transfer={transfer}
                  timeZone={settings.timeZone}
                />
              ))}
              <div className="flex items-center justify-between px-4 py-2.5 text-xs text-on-surface-variant">
                <span>
                  {t("dash.live.footer", {
                    shown: Math.min(6, ledger.transfers.length),
                    total: ledger.transfers.length,
                  })}
                </span>
                <Link href="/transfers" className="inline-flex items-center gap-1 text-primary hover:text-primary/80">
                  {t("dash.live.link")}
                  <Icon name="chevronRight" className="h-3.5 w-3.5" />
                </Link>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
