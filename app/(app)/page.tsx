import Link from "next/link";
import { AccountCard, type Recommendation } from "@/components/account-card";
import { EmptyState, PageHeader, SectionHeading, StatCard } from "@/components/ui";
import { Icon } from "@/components/icon";
import { TransferRow } from "@/components/transfer-row";
import { buildCandidates, quotaFor } from "@/lib/domain";
import { loadLedger } from "@/lib/queries";

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
  const ledger = await loadLedger();
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
  const active = ledger.transfers.filter((transfer) => transfer.status === "planned" || transfer.status === "sent");
  const minEx = accounts.length > 0 ? Math.min(...accounts.map((account) => account.minEx)) : 2;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Multi-vault central protocol · node id: PKT-8X-SYS"
        title="Ringkasan Defisit & Status Akun"
        description="Pantau minimal ex tiap akun, temukan surplus yang bisa dipindahkan, lalu eksekusi Share atau Trade dengan batas harian yang tercatat."
        actions={
          <>
            <Link href="/matcher" className="btn-primary">
              <Icon name="swap" className="h-4 w-4" />
              Jalankan Transfer Matcher
            </Link>
            <Link href="/inventory" className="btn-secondary">
              <Icon name="matrix" className="h-4 w-4" />
              Koreksi cepat
            </Link>
            <Link href="/planner" className="btn-secondary">
              <Icon name="planner" className="h-4 w-4" />
              Planner
            </Link>
          </>
        }
      />

      {ledger.catalogEmpty && (
        <div className="panel-raised flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-sm text-on-surface">Katalog kartu belum di-seed</p>
            <p className="text-body-sm text-on-surface-variant">
              Jalankan <code className="font-mono text-primary">npm run db:seed</code> untuk mengisi katalog
              dari dataset komunitas.
            </p>
          </div>
          <Link href="/settings" className="btn-secondary shrink-0">
            Lihat status sistem
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total akun terdaftar"
          value={accounts.length}
          hint="Akun aktif"
          icon="shield"
          tone="primary"
          detail={
            <span>
              <span className="text-primary">{accounts.length - deficitAccounts.length} memenuhi syarat</span>
              {" · "}
              <span className="text-secondary">{deficitAccounts.length} butuh bantuan</span>
              {untrackedAccounts.length > 0 && (
                <span className="text-outline"> · {untrackedAccounts.length} belum dicatat</span>
              )}
            </span>
          }
        />
        <StatCard
          label="Status kartu ex"
          value={deficitAccounts.length}
          hint="akun defisit ex"
          icon="alert"
          tone={deficitAccounts.length > 0 ? "secondary" : "success"}
          detail={
            <span>
              Minimal {minEx} ex unik per akun (diatur per akun di Settings).
            </span>
          }
        />
        <StatCard
          label="Trainer core defisit"
          value={trainerDeficit}
          hint="kartu di bawah target"
          icon="matrix"
          tone="tertiary"
          detail={
            <span>
              {criticalAccounts.length} akun kritis tanpa ex
              {criticalAccounts.length > 0 && (
                <span className="text-secondary"> · {criticalAccounts.map((item) => item.account.name.split(":")[0]).join(", ")}</span>
              )}
            </span>
          }
        />
        <StatCard
          label="Sisa kuota hari ini"
          value={`${Math.max(0, shareCapacity - shareUsed)}/${shareCapacity}`}
          hint="Share tersedia"
          icon="clock"
          tone="primary"
          detail={
            <span>
              Trade terpakai {tradeUsed} · reset pukul{" "}
              {String(settings.resetHour).padStart(2, "0")}:00 {settings.timeZone}
            </span>
          }
        />
      </div>

      <section>
        <SectionHeading
          title="Deficit & Surplus Radar"
          subtitle="Tiap akun dihitung dari kepemilikan tercatat. Rekomendasi hanya dari kartu yang aman dilepas."
          badge={`${accounts.length} node dimonitor`}
          action={
            <div className="flex items-center gap-3 font-mono text-label-sm text-outline">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> ready
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-secondary" /> needs ex
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> critical
              </span>
            </div>
          }
        />
        {summaries.length === 0 ? (
          <EmptyState
            icon="shield"
            title="Belum ada akun"
            description="Tambahkan akun Pokémon TCG Pocket kamu di halaman Settings."
            action={
              <Link href="/settings" className="btn-primary">
                Tambah akun
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
          title="Live Activity & Planned Transfers"
          subtitle="Konfirmasi transfer memperbarui kepemilikan kedua akun dalam satu transaksi database."
          badge={`${active.length} aktif`}
          action={
            <div className="flex items-center gap-1.5 font-mono text-label-sm uppercase tracking-wider text-outline">
              <span className="chip border-secondary/30 bg-secondary/10 text-secondary">
                planned {ledger.transfers.filter((item) => item.status === "planned").length}
              </span>
              <span className="chip border-primary/30 bg-primary/10 text-primary">
                sent {ledger.transfers.filter((item) => item.status === "sent").length}
              </span>
              <span className="chip border-success/30 bg-success/10 text-success">
                confirmed {ledger.transfers.filter((item) => item.status === "confirmed").length}
              </span>
            </div>
          }
        />
        <div className="panel overflow-hidden">
          {ledger.transfers.length === 0 ? (
            <EmptyState
              icon="swap"
              title="Belum ada transfer"
              description="Buka Transfer Matcher untuk membuat rencana Share atau Trade pertama."
              action={
                <Link href="/matcher" className="btn-primary">
                  Buka matcher
                </Link>
              }
            />
          ) : (
            <>
              <div className="hidden border-b border-white/[0.06] bg-surface-container-lowest/60 px-4 py-2 font-mono text-label-sm uppercase tracking-[0.12em] text-outline md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)_auto]">
                <span>Id & waktu</span>
                <span>Pemberi (surplus)</span>
                <span>Kartu / metode</span>
                <span className="text-right">Penerima & aksi</span>
              </div>
              {ledger.transfers.slice(0, 6).map((transfer) => (
                <TransferRow key={transfer.id} transfer={transfer} timeZone={settings.timeZone} />
              ))}
              <div className="flex items-center justify-between px-4 py-2.5 text-xs text-on-surface-variant">
                <span>
                  Menampilkan {Math.min(6, ledger.transfers.length)} dari {ledger.transfers.length} event terakhir.
                </span>
                <Link href="/transfers" className="inline-flex items-center gap-1 text-primary hover:text-primary/80">
                  Lihat ledger lengkap
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
