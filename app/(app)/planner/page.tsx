import Link from "next/link";
import { applyPlan, createTransfer } from "@/app/actions";
import { ActionButton } from "@/components/action-button";
import { MethodBadge, RarityChip, StatusBadge } from "@/components/badges";
import { CardImage } from "@/components/card-image";
import { Icon } from "@/components/icon";
import { EmptyState, PageHeader, SectionHeading, StatCard } from "@/components/ui";
import { accountShortName, formatDateTime } from "@/lib/format";
import { relativeDayLabel } from "@/lib/game-day";
import { getI18n } from "@/lib/i18n/server";
import { buildPlan, planSummaryByDay } from "@/lib/planner";
import { loadLedger } from "@/lib/queries";
import { staminaRegenPerDay } from "@/lib/resources";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("planner.metaTitle") };
}

export default async function PlannerPage() {
  const [ledger, { locale, t }] = await Promise.all([loadLedger(), getI18n()]);
  const { accounts, cards, holdings, settings, usage } = ledger;

  const plan = buildPlan({
    accounts,
    cards,
    holdings,
    settings,
    today: ledger.today,
    transfers: ledger.transfers,
    now: new Date(),
  });

  const todaySlotCount = plan.slots.filter((slot) => slot.dayIndex === 0).length;
  const staminaRegen = staminaRegenPerDay(settings);

  const byDay = planSummaryByDay(plan);
  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  const shareSlotsLeft = Math.max(
    0,
    accounts.length * settings.shareReceivePerDay -
      [...usage.receivedShare.values()].reduce((total, value) => total + value, 0),
  );
  const resetTime = `${String(settings.resetHour).padStart(2, "0")}:00`;
  const exDeficitLeft = plan.remaining.reduce((total, item) => total + item.exDeficit, 0);
  const trainerDeficitLeft = plan.remaining.reduce((total, item) => total + item.trainerDeficit, 0);

  const rules = [
    t("planner.rules.shareReceive", { count: settings.shareReceivePerDay }),
    t("planner.rules.sharePair", { count: settings.shareSendPerPairPerDay }),
    t("planner.rules.trade", {
      count: settings.tradePerAccountPerDay,
      cooldown: settings.tradePairCooldownDays,
    }),
    t("planner.rules.reset", { time: resetTime, timeZone: settings.timeZone }),
    t("planner.rules.resources", { regen: staminaRegen }),
    t("planner.rules.immovable"),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("planner.eyebrow")}
        title={t("planner.title")}
        description={t("planner.description")}
        actions={
          <>
            {todaySlotCount > 0 && (
              <ActionButton
                action={applyPlan}
                fields={{ days: "1" }}
                label={t("planner.action.applyToday", { count: todaySlotCount })}
                pendingLabel={t("common.saving")}
                icon="check"
                variant="primary"
                explain
              />
            )}
            {plan.totalSlots > todaySlotCount && (
              <ActionButton
                action={applyPlan}
                fields={{ days: "0" }}
                label={t("planner.action.applyAll", {
                  days: plan.daysUsed,
                  count: plan.totalSlots,
                })}
                pendingLabel={t("common.saving")}
                icon="planner"
                variant="secondary"
                explain
              />
            )}
            <Link href="/matcher" className="btn-secondary">
              <Icon name="swap" className="h-4 w-4" />
              {t("planner.action.matcher")}
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("planner.kpi.days.label")}
          value={t("planner.kpi.days.value", { days: plan.daysUsed })}
          hint={t(plan.feasible ? "planner.kpi.days.hint" : "planner.kpi.days.hintOpen")}
          tone={plan.feasible ? "primary" : "secondary"}
          icon="sparkles"
          detail={t("planner.kpi.days.detail", { count: plan.totalSlots })}
        />
        <StatCard
          label={t("planner.kpi.share.label")}
          value={`${shareSlotsLeft}/${accounts.length * settings.shareReceivePerDay}`}
          hint={t("planner.kpi.share.hint")}
          tone="primary"
          icon="clock"
          detail={t("planner.kpi.share.detail", { time: resetTime, timeZone: settings.timeZone })}
        />
        <StatCard
          label={t("planner.kpi.ex.label")}
          value={exDeficitLeft}
          hint={t("planner.kpi.ex.hint")}
          tone={exDeficitLeft > 0 ? "secondary" : "success"}
          icon="alert"
          detail={
            plan.remaining
              .filter((item) => item.exDeficit > 0)
              .map((item) => `${accountShortName(item.account.name)} (${item.exDeficit})`)
              .join(" · ") || t("planner.kpi.ex.detail")
          }
        />
        <StatCard
          label={t("planner.kpi.trainer.label")}
          value={trainerDeficitLeft}
          hint={t("planner.kpi.trainer.hint")}
          tone={trainerDeficitLeft > 0 ? "tertiary" : "success"}
          icon="matrix"
          detail={t("planner.kpi.trainer.detail", { days: settings.plannerHorizonDays })}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
        <section className="space-y-4">
          <SectionHeading
            title={t("planner.list.title")}
            subtitle={t("planner.list.subtitle")}
            badge={t("planner.list.badge", { count: days.length })}
          />

          {days.length === 0 ? (
            <EmptyState
              icon="check"
              title={t("planner.list.emptyTitle")}
              description={t("planner.list.emptyBody")}
              action={
                <Link href="/inventory" className="btn-secondary">
                  {t("planner.list.emptyAction")}
                </Link>
              }
            />
          ) : (
            days.map(([day, slots]) => (
              <div key={day} className="panel overflow-hidden">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] bg-surface-container-lowest/60 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-12 place-items-center rounded border border-primary/30 bg-primary/10 font-mono text-label-md text-primary">
                      {t("planner.dayBadge", { index: slots[0].dayIndex + 1 })}
                    </span>
                    <div>
                      <p className="font-display text-sm text-on-surface">
                        {relativeDayLabel(day, ledger.today, locale, t)} · {day}
                      </p>
                      <p className="font-mono text-label-sm text-outline">
                        {t("planner.daySlots", {
                          count: slots.length,
                          share: slots.filter((slot) => slot.method === "share").length,
                          trade: slots.filter((slot) => slot.method === "trade").length,
                        })}
                      </p>
                    </div>
                  </div>
                  <span className="chip border-white/10 bg-white/5 text-on-surface-variant">
                    {t("planner.dayQuota", { count: settings.shareReceivePerDay })}
                  </span>
                </header>

                <ul>
                  {slots.map((slot, index) => {
                    const plannedExists = ledger.transfers.some(
                      (transfer) =>
                        transfer.status === "planned" &&
                        transfer.fromAccountId === slot.from.id &&
                        transfer.toAccountId === slot.to.id &&
                        transfer.cardOutId === slot.card.id,
                    );
                    const reason = t(
                      slot.reason === "ex" ? "planner.reason.ex" : "planner.reason.trainer",
                    );

                    return (
                      <li
                        key={`${day}-${slot.card.id}-${slot.to.id}`}
                        className="border-b border-white/[0.05] p-3 last:border-b-0"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          <div className="flex items-center gap-3 sm:w-32">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 font-mono text-label-md text-secondary">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <CardImage
                              src={slot.card.imageUrl}
                              alt={slot.card.name}
                              className="h-16 w-11 shrink-0"
                              sizes="44px"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-1.5 font-display text-base text-on-surface">
                              {slot.card.name}
                              <RarityChip card={slot.card} />
                              <MethodBadge method={slot.method} />
                            </p>
                            <p className="mt-0.5 truncate font-mono text-label-sm text-outline">
                              {accountShortName(slot.from.name)} → {accountShortName(slot.to.name)} ·{" "}
                              {slot.card.setCode}-{String(slot.card.number).padStart(3, "0")}
                              {slot.cost > 0
                                ? ` · ${new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-GB").format(slot.cost)}`
                                : ""}
                            </p>
                            <p className="mt-1 text-body-sm text-on-surface-variant">
                              {slot.tradeBack
                                ? t("planner.reason.tradeBack", {
                                    reason,
                                    card: slot.tradeBack.name,
                                  })
                                : reason}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5">
                            {plannedExists ? (
                              <span className="chip border-success/30 bg-success/10 text-success">
                                <Icon name="check" className="h-3 w-3" />
                                {t("planner.slot.planned")}
                              </span>
                            ) : (
                              <ActionButton
                                action={createTransfer}
                                fields={{
                                  method: slot.method,
                                  fromAccountId: slot.from.id,
                                  toAccountId: slot.to.id,
                                  cardOutId: slot.card.id,
                                  cardInId: slot.tradeBack?.id ?? "",
                                  plannedDay: day,
                                }}
                                label={t("planner.slot.create")}
                                pendingLabel={t("common.saving")}
                                variant="secondary"
                                icon="plus"
                                explain
                                className="!px-2.5 !py-1.5 !text-xs"
                              />
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </section>

        <aside className="space-y-3">
          <section className="panel p-3">
            <h2 className="flex items-center gap-2 font-display text-base text-on-surface">
              <Icon name="shield" className="h-4 w-4 text-success" />
              {t("planner.rules.title")}
            </h2>
            <ul className="mt-2 space-y-1.5 text-body-sm text-on-surface-variant">
              {rules.map((rule, index) => (
                <li key={rule} className="flex gap-2">
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                      index === rules.length - 1 ? "bg-secondary" : "bg-primary"
                    }`}
                  />
                  {rule}
                </li>
              ))}
            </ul>
            <Link href="/settings" className="btn-secondary mt-3 w-full">
              {t("planner.rules.edit")}
            </Link>
            <p className="mt-2 text-[11px] text-on-surface-variant">{t("planner.action.applyNote")}</p>
          </section>

          <section className="panel p-3">
            <h2 className="flex items-center gap-2 font-display text-base text-on-surface">
              <Icon name="alert" className="h-4 w-4 text-secondary" />
              {t("planner.remaining.title")}
            </h2>
            <ul className="mt-2 space-y-1.5">
              {plan.remaining.map((item) => (
                <li key={item.account.id} className="flex items-center justify-between gap-2 text-body-sm">
                  <span className="truncate text-on-surface-variant">
                    {accountShortName(item.account.name)}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 font-mono text-label-md">
                    <span className={item.exDeficit > 0 ? "text-rose-300" : "text-success"}>
                      {t("planner.ex", { count: item.exDeficit })}
                    </span>
                    <span className="text-outline">|</span>
                    <span className={item.trainerDeficit > 0 ? "text-secondary" : "text-success"}>
                      {t("planner.trainer", { count: item.trainerDeficit })}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel p-3">
            <h2 className="flex items-center gap-2 font-display text-base text-on-surface">
              <Icon name="repeat" className="h-4 w-4 text-primary" />
              {t("planner.audit.title")}
            </h2>
            <ul className="mt-2 space-y-1.5">
              {ledger.transfers.slice(0, 6).map((transfer) => (
                <li key={transfer.id} className="flex items-center justify-between gap-2 text-body-sm">
                  <span className="min-w-0 truncate text-on-surface-variant">
                    <span className="font-mono text-label-sm text-outline">
                      {formatDateTime(transfer.createdAt, settings.timeZone, locale)}
                    </span>{" "}
                    {transfer.cardOut?.name ?? t("transfer.cardMissing")}
                  </span>
                  <StatusBadge status={transfer.status} />
                </li>
              ))}
              {ledger.transfers.length === 0 && (
                <li className="text-body-sm text-outline">{t("planner.audit.empty")}</li>
              )}
            </ul>
            <Link href="/transfers" className="btn-ghost mt-1 w-full">
              {t("planner.audit.link")}
              <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
