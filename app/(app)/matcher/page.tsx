import Link from "next/link";
import { createTransfer } from "@/app/actions";
import { ActionButton } from "@/components/action-button";
import { AccountPairPicker } from "@/components/account-pair-picker";
import { MethodBadge, RarityChip, StatusBadge } from "@/components/badges";
import { CardImage } from "@/components/card-image";
import { Icon } from "@/components/icon";
import { TransferRow } from "@/components/transfer-row";
import { EmptyState, PageHeader, SectionHeading, StatCard } from "@/components/ui";
import { tradeCost } from "@/lib/cards";
import { buildCandidates, holdingOf, quotaFor } from "@/lib/domain";
import { accountShortName } from "@/lib/format";
import { loadLedger } from "@/lib/queries";

export const metadata = { title: "Transfer Matcher — PocketLedger" };

export default async function MatcherPage(props: PageProps<"/matcher">) {
  const searchParams = await props.searchParams;
  const ledger = await loadLedger();
  const { accounts, cards, holdings, settings, usage } = ledger;

  if (accounts.length < 2) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Transfer matcher"
          title="Butuh minimal dua akun"
          description="Tambahkan akun lain dulu agar matcher bisa menghitung kandidat transfer."
        />
        <EmptyState
          icon="shield"
          title="Akun belum cukup"
          action={
            <Link href="/settings" className="btn-primary">
              Kelola akun
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
    accounts.find((account) => account.id === searchParams.to) ??
    firstDeficit?.account ??
    accounts[0];
  const sender =
    accounts.find((account) => account.id === searchParams.from && account.id !== receiver.id) ??
    accounts.find((account) => account.id !== receiver.id)!;

  const quota = quotaFor(sender.id, receiver.id, usage, settings);
  const candidates = buildCandidates({
    fromAccount: sender,
    toAccount: receiver,
    cards,
    holdings,
    settings,
    quota,
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Transfer matcher · F10–F13"
        title="Kandidat Kartu Transfer Layak"
        description="Kandidat = kartu milik pemberi yang belum dimiliki penerima, dan masih surplus setelah target sendiri terpenuhi."
        actions={
          <Link href={`/inventory?account=${receiver.id}`} className="btn-secondary">
            <Icon name="matrix" className="h-4 w-4" />
            Koreksi koleksi {accountShortName(receiver.name)}
          </Link>
        }
      />

      <section className="panel-raised relative overflow-hidden p-4">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-secondary/5 blur-3xl" />
        <AccountPairPicker accounts={accounts} receiverId={receiver.id} senderId={sender.id} />
        <div className="relative z-10 mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.07] pt-3 sm:grid-cols-4">
          <QuotaPill
            label="Sisa terima penerima"
            value={`${quota.receiveRemaining}/${settings.shareReceivePerDay}`}
            ok={quota.receiveRemaining > 0}
          />
          <QuotaPill
            label="Sisa kirim pasangan"
            value={`${quota.pairSendRemaining}/${settings.shareSendPerPairPerDay}`}
            ok={quota.pairSendRemaining > 0}
          />
          <QuotaPill
            label="Trade pemberi"
            value={`${quota.tradeFromRemaining}/${settings.tradePerAccountPerDay}`}
            ok={quota.tradeFromRemaining > 0 && !quota.tradePairBlocked}
          />
          <QuotaPill
            label="Trade penerima"
            value={`${quota.tradeToRemaining}/${settings.tradePerAccountPerDay}`}
            ok={quota.tradeToRemaining > 0 && !quota.tradePairBlocked}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`Defisit ${accountShortName(receiver.name)}`}
          value={receiverSummary?.exDeficit ?? 0}
          hint="ex unik kurang"
          tone={(receiverSummary?.exDeficit ?? 0) > 0 ? "secondary" : "success"}
          icon="alert"
          detail={`Trainer kurang ${receiverSummary?.trainerDeficit ?? 0} kartu`}
        />
        <StatCard
          label={`Surplus ${accountShortName(sender.name)}`}
          value={senderSummary?.surplus ?? 0}
          hint="kartu di atas target"
          tone="primary"
          icon="package"
          detail={`${senderSummary?.exCount ?? 0} ex unik · min ${sender.minEx}`}
        />
        <StatCard
          label="Kandidat siap eksekusi"
          value={candidates.filter((candidate) => candidate.allowedNow).length}
          hint={`${shareReady} share · ${tradeReady} trade`}
          tone="tertiary"
          icon="swap"
          detail={`${candidates.length} kandidat total untuk pasangan ini`}
        />
        <StatCard
          label="Kuota share hari ini"
          value={`${Math.max(0, settings.shareReceivePerDay - (usage.receivedShare.get(receiver.id) ?? 0))}/${settings.shareReceivePerDay}`}
          hint="tersedia untuk penerima"
          tone="primary"
          icon="clock"
          detail={`Reset ${String(settings.resetHour).padStart(2, "0")}:00 ${settings.timeZone}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2.15fr)_minmax(0,1fr)]">
        <section className="space-y-3">
          <SectionHeading
            title="Kandidat kartu"
            subtitle={`Dari ${sender.name} ke ${receiver.name}. Pilih satu untuk dijadwalkan, lalu eksekusi di game.`}
            badge={`${candidates.length} kandidat`}
            action={
              <span className="chip border-white/10 bg-white/5 text-on-surface-variant">filter: semua metode</span>
            }
          />

          {candidates.length === 0 ? (
            <EmptyState
              icon="search"
              title="Tidak ada kandidat"
              description="Pemberi tidak punya surplus yang belum dimiliki penerima. Coba pasangan akun lain, atau perbarui koleksi di Inventory Matrix."
              action={
                <Link href="/inventory" className="btn-secondary">
                  Perbarui koleksi
                </Link>
              }
            />
          ) : (
            <div className="space-y-2.5">
              {candidates.map((candidate) => {
                const senderState = holdingOf(holdings, sender.id, candidate.card.id);
                const receiverState = holdingOf(holdings, receiver.id, candidate.card.id);
                const cost = tradeCost(candidate.card, settings.tradeCosts);

                return (
                  <article key={candidate.card.id} className="panel overflow-hidden">
                    <div className="flex flex-col gap-3 p-3 sm:flex-row">
                      <CardImage
                        src={candidate.card.imageUrl}
                        alt={candidate.card.name}
                        className="h-32 w-24 shrink-0 self-start"
                        sizes="96px"
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
                            value={`${senderState.qty} (target ${senderState.targetQty})`}
                            tone="primary"
                          />
                          <Metric
                            label={accountShortName(receiver.name)}
                            value={`${receiverState.qty} dimiliki`}
                            tone={receiverState.qty === 0 ? "warning" : "muted"}
                          />
                          <Metric
                            label={candidate.method === "share" ? "Biaya" : "Shinedust"}
                            value={candidate.method === "share" ? "0" : cost.toLocaleString("id-ID")}
                          />
                          <Metric label="Surplus" value={`+${Math.max(0, candidate.spare)}`} tone="success" />
                        </div>

                        <p className="mt-2 text-body-sm text-on-surface-variant">{candidate.note}</p>

                        {candidate.method === "trade" && candidate.tradeBack && (
                          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-body-sm text-secondary">
                            <Icon name="swap" className="h-3.5 w-3.5" />
                            Saran pengganti dari {accountShortName(receiver.name)}:
                            <span className="font-medium">{candidate.tradeBack.card.name}</span>
                            <RarityChip card={candidate.tradeBack.card} />
                            <span className="font-mono text-label-sm text-outline">×{candidate.tradeBack.qty}</span>
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                          {!candidate.allowedNow && (
                            <span className="mr-auto flex items-center gap-1.5 text-xs text-secondary">
                              <Icon name="alert" className="h-3.5 w-3.5" />
                              {candidate.blockedReason}
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
                            label={candidate.method === "share" ? "Pilih untuk Share" : "Siapkan Trade"}
                            pendingLabel="Menyimpan..."
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
                Execution Plan
              </h2>
              <span className="chip border-primary/25 bg-primary/10 text-primary">
                {pairTransfers.filter((transfer) => transfer.status === "planned").length} planned
              </span>
            </div>

            {pairTransfers.length === 0 ? (
              <p className="mt-3 rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 text-body-sm text-on-surface-variant">
                Belum ada transfer untuk pasangan ini. Kandidat yang dipilih muncul di sini sebagai rencana.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {pairTransfers.map((transfer) => (
                  <li key={transfer.id} className="rounded-lg border border-white/[0.07] bg-surface-container-lowest/70 p-2">
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
                        <p className="truncate text-sm text-on-surface">{transfer.cardOut?.name ?? "—"}</p>
                        <p className="truncate font-mono text-label-sm text-outline">
                          {accountShortName(transfer.fromAccount.name)} → {accountShortName(transfer.toAccount.name)}
                        </p>
                      </div>
                      <StatusBadge status={transfer.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <ol className="mt-4 space-y-2">
              {[
                ["Planned di PocketLedger", "Slot kuota harian dicatat agar tidak bentrok dengan akun lain."],
                ["Eksekusi di Pokémon TCG Pocket", "Buka menu Social → Friends → Kirim Kartu / Trade sesuai ledger."],
                ["Konfirmasi di app", "Kepemilikan 8 akun diperbarui dalam satu transaksi."],
              ].map(([title, body], index) => (
                <li key={title} className="flex gap-2">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10 font-mono text-[10px] text-primary">
                    {index + 1}
                  </span>
                  <span>
                    <span className="block text-xs font-medium text-on-surface">{title}</span>
                    <span className="block text-[11px] text-on-surface-variant">{body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="panel p-3">
            <h2 className="flex items-center gap-2 font-display text-base text-on-surface">
              <Icon name="shield" className="h-4 w-4 text-success" />
              Dampak kuota
            </h2>
            <ul className="mt-2 space-y-1.5 text-body-sm text-on-surface-variant">
              <li className="flex items-center justify-between">
                <span>Terima hari ini</span>
                <span className="font-mono text-primary">
                  {usage.receivedShare.get(receiver.id) ?? 0} / {settings.shareReceivePerDay}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>Kirim pasangan ini</span>
                <span className="font-mono text-primary">
                  {usage.sharePairs.get(`${sender.id}|${receiver.id}`) ?? 0} / {settings.shareSendPerPairPerDay}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>Trade hari ini</span>
                <span className="font-mono text-primary">
                  {(usage.tradesPerAccount.get(sender.id) ?? 0) + (usage.tradesPerAccount.get(receiver.id) ?? 0)}
                  {" / "}
                  {settings.tradePerAccountPerDay * 2}
                </span>
              </li>
            </ul>
            <p className="mt-2 border-t border-white/[0.07] pt-2 text-[11px] text-on-surface-variant">
              Batas di atas ditegakkan server saat &quot;Tandai terkirim&quot; dan dicek ulang saat konfirmasi.
            </p>
          </section>

          <section className="panel p-3 text-body-sm text-on-surface-variant">
            <p className="font-display text-sm text-secondary">Catatan koleksi</p>
            <p className="mt-1">
              Kartu 3★, Immersive, dan Crown tidak bisa dipindahkan dan tidak pernah muncul sebagai kandidat.
            </p>
            <Link href="/inventory" className="btn-secondary mt-2 w-full">
              Buka Inventory Matrix
            </Link>
          </section>
        </aside>
      </div>

      {ledger.transfers.length > 0 && (
        <section>
          <SectionHeading title="Riwayat terbaru" subtitle="Semua pasangan akun, terbaru di atas." />
          <div className="panel overflow-hidden">
            {ledger.transfers.slice(0, 4).map((transfer) => (
              <TransferRow key={transfer.id} transfer={transfer} timeZone={settings.timeZone} dense />
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
