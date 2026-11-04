import Link from "next/link";
import { Icon } from "@/components/icon";
import { TransferRow } from "@/components/transfer-row";
import { EmptyState, PageHeader, SectionHeading, StatCard } from "@/components/ui";
import { loadLedger } from "@/lib/queries";
import type { TransferStatus } from "@/db/schema";

export const metadata = { title: "Riwayat Transfer — PocketLedger" };

const FILTERS: { value: "all" | TransferStatus; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "planned", label: "Planned" },
  { value: "sent", label: "In flight" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
];

export default async function TransfersPage(props: PageProps<"/transfers">) {
  const searchParams = await props.searchParams;
  const ledger = await loadLedger();
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
        eyebrow="Append-only vault ledger · F14–F17"
        title="Riwayat Transfer"
        description="Riwayat tidak dihapus. Koreksi dilakukan dengan membuat transfer baru; konfirmasi bersifat idempoten dan atomik."
        actions={
          <Link href="/matcher" className="btn-primary">
            <Icon name="plus" className="h-4 w-4" />
            Transfer baru
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Planned" value={counts.planned} hint="menunggu eksekusi" tone="secondary" icon="clock" />
        <StatCard label="In flight" value={counts.sent} hint="sudah dikirim di game" tone="primary" icon="send" />
        <StatCard label="Confirmed" value={counts.confirmed} hint="kepemilikan tersinkron" tone="success" icon="shield" />
        <StatCard label="Cancelled" value={counts.cancelled} hint="arsip" tone="tertiary" icon="x" />
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
              {filter.label}
            </Link>
          );
        })}
      </div>

      <section>
        <SectionHeading
          title="Ledger event"
          subtitle="Terbaru di atas. Tandai terkirim setelah eksekusi di game, lalu konfirmasi agar stok berubah."
          badge={`${rows.length} event`}
        />
        <div className="panel overflow-hidden">
          {rows.length === 0 ? (
            <EmptyState
              icon="repeat"
              title="Belum ada event"
              description="Buat rencana transfer dari matcher atau planner untuk memulai ledger."
              action={
                <Link href="/matcher" className="btn-primary">
                  Buka matcher
                </Link>
              }
            />
          ) : (
            rows.map((transfer) => (
              <TransferRow key={transfer.id} transfer={transfer} timeZone={ledger.settings.timeZone} />
            ))
          )}
        </div>
        {ledger.transfers.length >= 200 && (
          <p className="mt-2 text-body-sm text-outline">
            Menampilkan 200 event terbaru. Arsip lebih lama tetap tersimpan di database.
          </p>
        )}
      </section>
    </div>
  );
}
