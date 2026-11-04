import Link from "next/link";
import { createTransfer } from "@/app/actions";
import { ActionButton } from "@/components/action-button";
import { MethodBadge, RarityChip, StatusBadge } from "@/components/badges";
import { CardImage } from "@/components/card-image";
import { Icon } from "@/components/icon";
import { EmptyState, PageHeader, SectionHeading, StatCard } from "@/components/ui";
import { accountShortName, formatDateTime } from "@/lib/format";
import { relativeDayLabel } from "@/lib/game-day";
import { buildPlan, planSummaryByDay } from "@/lib/planner";
import { loadLedger } from "@/lib/queries";

export const metadata = { title: "Daily Transfer Planner — PocketLedger" };

export default async function PlannerPage() {
  const ledger = await loadLedger();
  const { accounts, cards, holdings, settings, usage } = ledger;

  const plan = buildPlan({
    accounts,
    cards,
    holdings,
    settings,
    today: ledger.today,
    transfers: ledger.transfers,
  });

  const byDay = planSummaryByDay(plan);
  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  const shareSlotsLeft = Math.max(
    0,
    usage.gameDay === ledger.today
      ? accounts.length * settings.shareReceivePerDay -
          [...usage.receivedShare.values()].reduce((total, value) => total + value, 0)
      : accounts.length * settings.shareReceivePerDay,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="F14 · F15 · F16 · F18 · F19 core engine · greedy dispatch matrix"
        title="Daily Transfer Planner"
        description="Algoritma greedy menyusun jadwal paling cepat untuk menutup defisit ex dan trainer, mematuhi batas Share per akun per hari serta kuota Trade."
        actions={
          <Link href="/matcher" className="btn-secondary">
            <Icon name="swap" className="h-4 w-4" />
            Matcher manual
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Estimasi solusi"
          value={`${plan.daysUsed} hari`}
          hint={plan.feasible ? "hingga nol defisit" : "masih ada sisa defisit"}
          tone={plan.feasible ? "primary" : "secondary"}
          icon="sparkles"
          detail={`${plan.totalSlots} slot transfer dijadwalkan`}
        />
        <StatCard
          label="Sisa kuota share"
          value={`${shareSlotsLeft}/${accounts.length * settings.shareReceivePerDay}`}
          hint="slot hari ini"
          tone="primary"
          icon="clock"
          detail={`Reset ${String(settings.resetHour).padStart(2, "0")}:00 ${settings.timeZone}`}
        />
        <StatCard
          label="Defisit ex tersisa"
          value={plan.remaining.reduce((total, item) => total + item.exDeficit, 0)}
          hint="setelah jadwal dijalankan"
          tone={plan.remaining.some((item) => item.exDeficit > 0) ? "secondary" : "success"}
          icon="alert"
          detail={plan.remaining
            .filter((item) => item.exDeficit > 0)
            .map((item) => `${accountShortName(item.account.name)} (${item.exDeficit})`)
            .join(" · ") || "Semua akun memenuhi minimal ex"}
        />
        <StatCard
          label="Defisit trainer"
          value={plan.remaining.reduce((total, item) => total + item.trainerDeficit, 0)}
          hint="kartu di bawah target"
          tone={plan.remaining.some((item) => item.trainerDeficit > 0) ? "tertiary" : "success"}
          icon="matrix"
          detail={`Horizon ${settings.plannerHorizonDays} hari`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
        <section className="space-y-4">
          <SectionHeading
            title="Jadwal harian"
            subtitle="Urutan prioritas: defisit ex terbesar, lalu trainer. Share dipakai lebih dulu; Trade hanya bila kartu tidak bisa di-Share."
            badge={`${days.length} hari terpakai`}
          />

          {days.length === 0 ? (
            <EmptyState
              icon="check"
              title="Tidak ada defisit yang bisa dijadwalkan"
              description="Semua target terpenuhi, atau semua kartu yang dibutuhkan sudah habis di akun pemberi. Cek Inventory Matrix untuk memastikan koleksi sudah dicatat."
              action={
                <Link href="/inventory" className="btn-secondary">
                  Buka Inventory Matrix
                </Link>
              }
            />
          ) : (
            days.map(([day, slots]) => (
              <div key={day} className="panel overflow-hidden">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] bg-surface-container-lowest/60 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-12 place-items-center rounded border border-primary/30 bg-primary/10 font-mono text-label-md text-primary">
                      H{slots[0].dayIndex + 1}
                    </span>
                    <div>
                      <p className="font-display text-sm text-on-surface">
                        {relativeDayLabel(day, ledger.today)} · {day}
                      </p>
                      <p className="font-mono text-label-sm text-outline">
                        {slots.length} slot · {slots.filter((slot) => slot.method === "share").length} share ·{" "}
                        {slots.filter((slot) => slot.method === "trade").length} trade
                      </p>
                    </div>
                  </div>
                  <span className="chip border-white/10 bg-white/5 text-on-surface-variant">
                    {settings.shareReceivePerDay} terima / akun
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

                    return (
                      <li key={`${day}-${slot.card.id}-${slot.to.id}`} className="border-b border-white/[0.05] p-3 last:border-b-0">
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
                              {slot.cost > 0 ? ` · ${slot.cost.toLocaleString("id-ID")} shinedust` : ""}
                            </p>
                            <p className="mt-1 text-body-sm text-on-surface-variant">
                              {slot.tradeBack
                                ? `${slot.reason} Tukar dengan ${slot.tradeBack.name}.`
                                : slot.reason}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5">
                            {plannedExists ? (
                              <span className="chip border-success/30 bg-success/10 text-success">
                                <Icon name="check" className="h-3 w-3" /> sudah di ledger
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
                                label="Buat rencana"
                                pendingLabel="Menyimpan..."
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
              Constraint engine rules
            </h2>
            <ul className="mt-2 space-y-1.5 text-body-sm text-on-surface-variant">
              {plan.assumptions.map((assumption) => (
                <li key={assumption} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {assumption}
                </li>
              ))}
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                Kartu 3★ / Immersive / Crown tidak dipindahkan dan tidak pernah masuk jadwal.
              </li>
            </ul>
            <Link href="/settings" className="btn-secondary mt-3 w-full">
              Ubah aturan
            </Link>
          </section>

          <section className="panel p-3">
            <h2 className="flex items-center gap-2 font-display text-base text-on-surface">
              <Icon name="alert" className="h-4 w-4 text-secondary" />
              Sisa defisit per akun
            </h2>
            <ul className="mt-2 space-y-1.5">
              {plan.remaining.map((item) => (
                <li key={item.account.id} className="flex items-center justify-between gap-2 text-body-sm">
                  <span className="truncate text-on-surface-variant">{accountShortName(item.account.name)}</span>
                  <span className="flex shrink-0 items-center gap-1.5 font-mono text-label-md">
                    <span className={item.exDeficit > 0 ? "text-rose-300" : "text-success"}>
                      EX {item.exDeficit}
                    </span>
                    <span className="text-outline">|</span>
                    <span className={item.trainerDeficit > 0 ? "text-secondary" : "text-success"}>
                      TR {item.trainerDeficit}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel p-3">
            <h2 className="flex items-center gap-2 font-display text-base text-on-surface">
              <Icon name="repeat" className="h-4 w-4 text-primary" />
              Audit log terbaru
            </h2>
            <ul className="mt-2 space-y-1.5">
              {ledger.transfers.slice(0, 6).map((transfer) => (
                <li key={transfer.id} className="flex items-center justify-between gap-2 text-body-sm">
                  <span className="min-w-0 truncate text-on-surface-variant">
                    <span className="font-mono text-label-sm text-outline">
                      {formatDateTime(transfer.createdAt, settings.timeZone)}
                    </span>{" "}
                    {transfer.cardOut?.name ?? "—"}
                  </span>
                  <StatusBadge status={transfer.status} />
                </li>
              ))}
              {ledger.transfers.length === 0 && (
                <li className="text-body-sm text-outline">Belum ada event transfer.</li>
              )}
            </ul>
            <Link href="/transfers" className="btn-ghost mt-1 w-full">
              Lihat semua riwayat
              <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
