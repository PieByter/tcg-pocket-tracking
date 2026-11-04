import Link from "next/link";
import { createTransfer, saveResources } from "@/app/actions";
import { ActionButton } from "@/components/action-button";
import { ActionForm } from "@/components/action-form";
import { AccountPairPicker } from "@/components/account-pair-picker";
import { MethodBadge, RarityChip, StatusBadge } from "@/components/badges";
import { CardImage } from "@/components/card-image";
import { Icon } from "@/components/icon";
import { TransferRow } from "@/components/transfer-row";
import { EmptyState, PageHeader, SectionHeading, StatCard } from "@/components/ui";
import { tradeCost } from "@/lib/cards";
import { buildCandidates, holdingOf, quotaFor, type CandidateBlock } from "@/lib/domain";
import { accountShortName, formatNumber } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { loadLedger } from "@/lib/queries";
import { requireUser } from "@/lib/auth";
import { estimateResources } from "@/lib/resources";

const blockKeys: Record<CandidateBlock, MessageKey> = {
  receiveQuota: "matcher.block.receiveQuota",
  tradeCooldown: "matcher.block.tradeCooldown",
  tradeFromQuota: "matcher.block.tradeFromQuota",
  tradeToQuota: "matcher.block.tradeToQuota",
  noTradeBack: "matcher.block.noTradeBack",
  noStamina: "matcher.block.noStamina",
  noShinedust: "matcher.block.noShinedust",
};

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("matcher.metaTitle") };
}

export default async function MatcherPage(props: PageProps<"/matcher">) {
  const user = await requireUser();
  const [searchParams, ledger] = await Promise.all([props.searchParams, loadLedger(user.id)]);
  const { locale, t } = await getI18n();
  const { accounts, cards, holdings, settings, usage } = ledger;

  if (accounts.length < 2) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={t("matcher.eyebrow")}
          title={t("matcher.needTwo.title")}
          description={t("matcher.needTwo.description")}
        />
        <EmptyState
          icon="shield"
          title={t("matcher.notEnough.title")}
          action={
            <Link href="/settings" className="btn-primary">
              {t("matcher.needTwo.action")}
            </Link>
          }
        />
      </div>
    );
  }

  const firstDeficit = ledger.summaries
    .filter((summary) => summary.exDeficit > 0)
    .sort((a, b) => b.exDeficit - a.exDeficit)[0];

  const receiver =
    accounts.find((account) => account.id === searchParams.to) ?? firstDeficit?.account ?? accounts[0];
  const sender =
    accounts.find((account) => account.id === searchParams.from && account.id !== receiver.id) ??
    accounts.find((account) => account.id !== receiver.id)!;

  const quota = quotaFor(sender.id, receiver.id, usage, settings);
  const now = new Date();
  const senderResources = estimateResources(sender, now, settings);
  const receiverResources = estimateResources(receiver, now, settings);
  const candidates = buildCandidates({
    fromAccount: sender,
    toAccount: receiver,
    cards,
    holdings,
    settings,
    quota,
    now,
  });

  const receiverSummary = ledger.summaries.find((summary) => summary.account.id === receiver.id);
  const senderSummary = ledger.summaries.find((summary) => summary.account.id === sender.id);

  const pairTransfers = ledger.transfers
    .filter(
      (transfer) =>
        (transfer.fromAccountId === sender.id && transfer.toAccountId === receiver.id) ||
        (transfer.fromAccountId === receiver.id && transfer.toAccountId === sender.id),
    )
    .slice(0, 5);

  const shareReady = candidates.filter((candidate) => candidate.method === "share" && candidate.allowedNow).length;
  const tradeReady = candidates.filter((candidate) => candidate.method === "trade" && candidate.allowedNow).length;
  const resetTime = `${String(settings.resetHour).padStart(2, "0")}:00`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("matcher.eyebrow")}
        title={t("matcher.title")}
        description={t("matcher.description")}
        actions={
          <Link href={`/inventory?account=${receiver.id}`} className="btn-secondary">
            <Icon name="matrix" className="h-4 w-4" />
            {t("matcher.action.correct", { account: accountShortName(receiver.name) })}
          </Link>
        }
      />

      <section className="panel-raised relative overflow-hidden p-4">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-secondary/5 blur-3xl" />
        <AccountPairPicker accounts={accounts} receiverId={receiver.id} senderId={sender.id} />
        <div className="relative z-10 mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.07] pt-3 sm:grid-cols-3 xl:grid-cols-5">
          <QuotaPill
            label={t("matcher.quota.receive")}
            value={`${quota.receiveRemaining}/${settings.shareReceivePerDay}`}
            ok={quota.receiveRemaining > 0}
          />
          <QuotaPill
            label={t("matcher.quota.tradeFrom")}
            value={`${quota.tradeFromRemaining}/${settings.tradePerAccountPerDay}`}
            ok={quota.tradeFromRemaining > 0 && !quota.tradePairBlocked}
          />
          <QuotaPill
            label={t("matcher.quota.tradeTo")}
            value={`${quota.tradeToRemaining}/${settings.tradePerAccountPerDay}`}
            ok={quota.tradeToRemaining > 0 && !quota.tradePairBlocked}
          />
          <QuotaPill
            label={t("matcher.quota.stamina")}
            value={`${senderResources.stamina}/${settings.maxTradeStamina}`}
            ok={senderResources.stamina > 0}
          />
          <QuotaPill
            label={t("matcher.quota.shinedust")}
            value={formatNumber(senderResources.shinedust, locale)}
            ok={senderResources.shinedust > 0}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("matcher.kpi.def", { account: accountShortName(receiver.name) })}
          value={receiverSummary?.exDeficit ?? 0}
          hint={t("matcher.kpi.defHint")}
          tone={(receiverSummary?.exDeficit ?? 0) > 0 ? "secondary" : "success"}
          icon="alert"
          detail={t("matcher.kpi.defDetail", { count: receiverSummary?.trainerDeficit ?? 0 })}
        />
        <StatCard
          label={t("matcher.kpi.surplus", { account: accountShortName(sender.name) })}
          value={senderSummary?.surplus ?? 0}
          hint={t("matcher.kpi.surplusHint")}
          tone="primary"
          icon="package"
          detail={t("matcher.kpi.surplusDetail", {
            ex: senderSummary?.exCount ?? 0,
            min: sender.minEx,
          })}
        />
        <StatCard
          label={t("matcher.kpi.ready")}
          value={candidates.filter((candidate) => candidate.allowedNow).length}
          hint={t("matcher.kpi.readyHint", { share: shareReady, trade: tradeReady })}
          tone="tertiary"
          icon="swap"
          detail={t("matcher.kpi.readyDetail", { count: candidates.length })}
        />
        <StatCard
          label={t("matcher.kpi.share")}
          value={`${Math.max(
            0,
            settings.shareReceivePerDay - (usage.receivedShare.get(receiver.id) ?? 0),
          )}/${settings.shareReceivePerDay}`}
          hint={t("matcher.kpi.shareHint")}
          tone="primary"
          icon="clock"
          detail={t("matcher.kpi.shareDetail", { time: resetTime, timeZone: settings.timeZone })}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2.15fr)_minmax(0,1fr)]">
        <section className="space-y-3">
          <SectionHeading
            title={t("matcher.list.title")}
            subtitle={t("matcher.list.subtitle", {
              from: sender.name,
              to: receiver.name,
            })}
            badge={t("matcher.list.badge", { count: candidates.length })}
            action={
              <span className="chip border-white/10 bg-white/5 text-on-surface-variant">
                {t("matcher.list.filter")}
              </span>
            }
          />

          {candidates.length === 0 ? (
            <EmptyState
              icon="search"
              title={t("matcher.list.emptyTitle")}
              description={t("matcher.list.emptyBody")}
              action={
                <Link href="/inventory" className="btn-secondary">
                  {t("matcher.list.emptyAction")}
                </Link>
              }
            />
          ) : (
            <div className="space-y-2.5">
              {candidates.map((candidate, candidateIndex) => {
                const senderState = holdingOf(holdings, sender.id, candidate.card.id);
                const receiverState = holdingOf(holdings, receiver.id, candidate.card.id);
                const cost = tradeCost(candidate.card, settings.tradeCosts);
                const note =
                  candidate.method === "share"
                    ? candidate.spare > 0
                      ? t("matcher.note.surplus", { spare: candidate.spare })
                      : t("matcher.note.singleEx", {
                          account: accountShortName(sender.name),
                          min: sender.minEx,
                        })
                    : candidate.tradeBack
                      ? t("matcher.note.tradeReady", { card: candidate.tradeBack.card.name })
                      : t("matcher.note.tradeNeedsPartner");

                return (
                  <article key={candidate.card.id} className="panel overflow-hidden">
                    <div className="flex flex-col gap-3 p-3 sm:flex-row">
                      <CardImage
                        src={candidate.card.imageUrl}
                        alt={candidate.card.name}
                        className="h-32 w-24 shrink-0 self-start"
                        sizes="96px"
                        priority={candidateIndex === 0}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="flex flex-wrap items-center gap-2 font-display text-lg font-semibold leading-tight text-on-surface">
                              {candidate.card.name}
                              <RarityChip card={candidate.card} />
                            </h3>
                            <p className="mt-0.5 font-mono text-label-sm text-outline">
                              {candidate.card.setName} ({candidate.card.setCode}) · #
                              {String(candidate.card.number).padStart(3, "0")}
                              {candidate.card.element ? ` · ${candidate.card.element}` : ""}
                            </p>
                          </div>
                          <MethodBadge method={candidate.method} />
                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                          <Metric
                            label={accountShortName(sender.name)}
                            value={t("matcher.metric.senderValue", {
                              qty: senderState.qty,
                              target: senderState.targetQty,
                            })}
                            tone="primary"
                          />
                          <Metric
                            label={accountShortName(receiver.name)}
                            value={t("matcher.metric.receiverValue", { qty: receiverState.qty })}
                            tone={receiverState.qty === 0 ? "warning" : "muted"}
                          />
                          <Metric
                            label={t(
                              candidate.method === "share"
                                ? "matcher.metric.cost"
                                : "matcher.metric.shinedust",
                            )}
                            value={
                              candidate.method === "share"
                                ? t("matcher.metric.free")
                                : formatNumber(cost, locale)
                            }
                          />
                          <Metric
                            label={t("matcher.metric.spare")}
                            value={`+${Math.max(0, candidate.spare)}`}
                            tone="success"
                          />
                        </div>

                        <p className="mt-2 text-body-sm text-on-surface-variant">{note}</p>

                        {candidate.method === "trade" && candidate.tradeBack && (
                          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-body-sm text-secondary">
                            <Icon name="swap" className="h-3.5 w-3.5" />
                            {t("matcher.tradeBack", { account: accountShortName(receiver.name) })}
                            <span className="font-medium">{candidate.tradeBack.card.name}</span>
                            <RarityChip card={candidate.tradeBack.card} />
                            <span className="font-mono text-label-sm text-outline">
                              ×{candidate.tradeBack.qty}
                            </span>
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                          {!candidate.allowedNow && candidate.blockedReason && (
                            <span className="mr-auto flex items-center gap-1.5 text-xs text-secondary">
                              <Icon name="alert" className="h-3.5 w-3.5" />
                              {t(blockKeys[candidate.blockedReason])}
                            </span>
                          )}
                          <ActionButton
                            action={createTransfer}
                            fields={{
                              method: candidate.method,
                              fromAccountId: sender.id,
                              toAccountId: receiver.id,
                              cardOutId: candidate.card.id,
                              cardInId:
                                candidate.method === "trade" ? candidate.tradeBack?.card.id ?? "" : "",
                            }}
                            label={t(
                              candidate.method === "share" ? "matcher.action.share" : "matcher.action.trade",
                            )}
                            pendingLabel={t("common.saving")}
                            variant={candidate.allowedNow ? "primary" : "secondary"}
                            icon="plus"
                            explain
                          />
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="space-y-3">
          <section className="panel-raised p-3">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-base text-on-surface">
                <Icon name="send" className="h-4 w-4 text-primary" />
                {t("matcher.plan.title")}
              </h2>
              <span className="chip border-primary/25 bg-primary/10 text-primary">
                {t("matcher.plan.planned", {
                  count: pairTransfers.filter((transfer) => transfer.status === "planned").length,
                })}
              </span>
            </div>

            {pairTransfers.length === 0 ? (
              <p className="mt-3 rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 text-body-sm text-on-surface-variant">
                {t("matcher.plan.empty")}
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {pairTransfers.map((transfer) => (
                  <li
                    key={transfer.id}
                    className="rounded-lg border border-white/[0.07] bg-surface-container-lowest/70 p-2"
                  >
                    <div className="flex items-center gap-2">
                      {transfer.cardOut && (
                        <CardImage
                          src={transfer.cardOut.imageUrl}
                          alt={transfer.cardOut.name}
                          className="h-11 w-8 shrink-0"
                          sizes="32px"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-on-surface">
                          {transfer.cardOut?.name ?? t("transfer.cardMissing")}
                        </p>
                        <p className="truncate font-mono text-label-sm text-outline">
                          {accountShortName(transfer.fromAccount.name)} →{" "}
                          {accountShortName(transfer.toAccount.name)}
                        </p>
                      </div>
                      <StatusBadge status={transfer.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <ol className="mt-4 space-y-2">
              {(
                [
                  ["matcher.plan.step1.title", "matcher.plan.step1.body"],
                  ["matcher.plan.step2.title", "matcher.plan.step2.body"],
                  ["matcher.plan.step3.title", "matcher.plan.step3.body"],
                ] as [MessageKey, MessageKey][]
              ).map(([titleKey, bodyKey], index) => (
                <li key={titleKey} className="flex gap-2">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10 font-mono text-[10px] text-primary">
                    {index + 1}
                  </span>
                  <span>
                    <span className="block text-xs font-medium text-on-surface">{t(titleKey)}</span>
                    <span className="block text-[11px] text-on-surface-variant">{t(bodyKey)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="panel p-3">
            <h2 className="flex items-center gap-2 font-display text-base text-on-surface">
              <Icon name="shield" className="h-4 w-4 text-success" />
              {t("matcher.quotaImpact.title")}
            </h2>
            <ul className="mt-2 space-y-1.5 text-body-sm text-on-surface-variant">
              <li className="flex items-center justify-between">
                <span>{t("matcher.quotaImpact.received")}</span>
                <span className="font-mono text-primary">
                  {usage.receivedShare.get(receiver.id) ?? 0} / {settings.shareReceivePerDay}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>{t("matcher.quotaImpact.trades")}</span>
                <span className="font-mono text-primary">
                  {(usage.tradesPerAccount.get(sender.id) ?? 0) +
                    (usage.tradesPerAccount.get(receiver.id) ?? 0)}
                  {" / "}
                  {settings.tradePerAccountPerDay * 2}
                </span>
              </li>
            </ul>
            <p className="mt-2 border-t border-white/[0.07] pt-2 text-[11px] text-on-surface-variant">
              {t("matcher.quotaImpact.note")}
            </p>
          </section>

          <section className="panel p-3">
            <h2 className="flex items-center gap-2 font-display text-base text-on-surface">
              <Icon name="bolt" className="h-4 w-4 text-secondary" />
              {t("matcher.resources.title")}
            </h2>
            <p className="mt-1 text-[11px] text-on-surface-variant">
              {t("matcher.resources.subtitle", { hours: settings.tradeStaminaRegenHours })}
            </p>

            <div className="mt-3 space-y-3">
              {[
                { account: sender, state: senderResources, role: t("matcher.sender.label") },
                { account: receiver, state: receiverResources, role: t("matcher.receiver.label") },
              ].map((entry) => (
                <ActionForm
                  key={entry.account.id}
                  action={saveResources}
                  submitLabel={t("matcher.resources.save")}
                  submitIcon="check"
                  compact
                >
                  <input type="hidden" name="accountId" value={entry.account.id} />
                  <p className="mb-1 truncate font-display text-xs text-on-surface">
                    {entry.account.name}
                    <span className="ml-1 font-mono text-label-sm uppercase text-outline">
                      {entry.role}
                    </span>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] uppercase tracking-wider text-outline">
                      {t("matcher.resources.stamina")}
                      <input
                        name="stamina"
                        type="number"
                        min={0}
                        max={99}
                        defaultValue={entry.state.stamina}
                        className="field mt-0.5 font-mono !py-1"
                      />
                      <span className="mt-0.5 block normal-case tracking-normal text-[10px] text-outline">
                        {entry.state.hoursToNextStamina === null
                          ? t("matcher.resources.max")
                          : t("matcher.resources.next", { hours: entry.state.hoursToNextStamina })}
                        {entry.state.regenSinceUpdate > 0
                          ? ` · ${t("account.resourcesEstimated", { count: entry.state.regenSinceUpdate })}`
                          : ""}
                      </span>
                    </label>
                    <label className="text-[10px] uppercase tracking-wider text-outline">
                      {t("matcher.resources.shinedust")}
                      <input
                        name="shinedust"
                        type="number"
                        min={0}
                        max={9999999}
                        step={100}
                        defaultValue={entry.state.shinedust}
                        className="field mt-0.5 font-mono !py-1"
                      />
                    </label>
                  </div>
                </ActionForm>
              ))}
            </div>

            <p className="mt-2 border-t border-white/[0.07] pt-2 text-[11px] text-on-surface-variant">
              {t("matcher.resources.note")}
            </p>
          </section>

          <section className="panel p-3 text-body-sm text-on-surface-variant">
            <p className="font-display text-sm text-secondary">{t("matcher.collection.title")}</p>
            <p className="mt-1">{t("matcher.collection.body")}</p>
            <Link href="/inventory" className="btn-secondary mt-2 w-full">
              {t("matcher.collection.action")}
            </Link>
          </section>
        </aside>
      </div>

      {ledger.transfers.length > 0 && (
        <section>
          <SectionHeading title={t("matcher.history.title")} subtitle={t("matcher.history.subtitle")} />
          <div className="panel overflow-hidden">
            {ledger.transfers.slice(0, 4).map((transfer) => (
              <TransferRow
                key={transfer.id}
                transfer={transfer}
                timeZone={settings.timeZone}
                dense
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function QuotaPill({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-2 py-1.5">
      <p className="font-mono text-label-sm uppercase tracking-wider text-outline">{label}</p>
      <p className={`mt-0.5 font-mono text-sm ${ok ? "text-primary" : "text-rose-300"}`}>{value}</p>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "muted" | "primary" | "warning" | "success";
}) {
  const color = {
    muted: "text-on-surface-variant",
    primary: "text-primary",
    warning: "text-secondary",
    success: "text-success",
  }[tone];
  return (
    <div>
      <p className="font-mono text-label-sm uppercase tracking-wider text-outline">{label}</p>
      <p className={`font-mono text-sm ${color}`}>{value}</p>
    </div>
  );
}
