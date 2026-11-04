import Link from "next/link";
import { InventoryMatrix } from "@/components/inventory-matrix";
import { Icon } from "@/components/icon";
import { EmptyState, PageHeader, SectionHeading } from "@/components/ui";
import { RARITY_GROUPS } from "@/lib/cards";
import { loadInventoryPage, loadLedger } from "@/lib/queries";

export const metadata = { title: "Inventory Matrix — PocketLedger" };

function buildQuery(params: Record<string, string | undefined>, page: number) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && value !== "all") query.set(key, value);
  }
  if (page > 1) query.set("page", String(page));
  const text = query.toString();
  return text ? `/inventory?${text}` : "/inventory";
}

export default async function InventoryPage(props: PageProps<"/inventory">) {
  const searchParams = await props.searchParams;
  const filters = {
    search: typeof searchParams.q === "string" ? searchParams.q : undefined,
    setCode: typeof searchParams.set === "string" ? searchParams.set : undefined,
    kind: (typeof searchParams.kind === "string" ? searchParams.kind : "focus") as
      | "focus"
      | "ex"
      | "trainer"
      | "other"
      | "all",
    rarity: typeof searchParams.rarity === "string" ? searchParams.rarity : undefined,
    page: Number(searchParams.page ?? 1) || 1,
  };

  const [page, ledger] = await Promise.all([loadInventoryPage(filters), loadLedger()]);
  const { accounts, settings, summaries } = ledger;
  const focusAccountId = typeof searchParams.account === "string" ? searchParams.account : undefined;
  const focusAccount = accounts.find((account) => account.id === focusAccountId);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Ledger registry F4–F7 · 8-node parallel sync"
        title="Inventory Matrix"
        description="Edit kuantitas dan target langsung di tabel. Perubahan disimpan sekaligus dalam satu batch, lalu seluruh kalkulasi defisit diperbarui."
        actions={
          <Link href="/matcher" className="btn-secondary">
            <Icon name="swap" className="h-4 w-4" />
            Buka Transfer Matcher
          </Link>
        }
      />

      <form action="/inventory" method="get" className="panel space-y-3 p-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
            <input
              type="search"
              name="q"
              defaultValue={filters.search ?? ""}
              placeholder="Cari kartu (nama, pokemon, set, nomor)…"
              className="field pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select name="set" defaultValue={filters.setCode ?? "all"} className="field w-auto">
              <option value="all">Semua set</option>
              {page.sets.map((set) => (
                <option key={set.code} value={set.code}>
                  {set.name} ({set.code})
                </option>
              ))}
            </select>
            <select name="kind" defaultValue={filters.kind} className="field w-auto">
              <option value="focus">Fokus: ex + trainer ≤3◇</option>
              <option value="ex">Hanya ex</option>
              <option value="trainer">Hanya trainer</option>
              <option value="other">Kartu lain</option>
              <option value="all">Semua jenis</option>
            </select>
            <select name="rarity" defaultValue={filters.rarity ?? "all"} className="field w-auto">
              <option value="all">Semua rarity</option>
              {RARITY_GROUPS.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-primary">
              <Icon name="filter" className="h-4 w-4" />
              Terapkan
            </button>
            <Link href="/inventory" className="btn-ghost">
              Reset
            </Link>
          </div>
        </div>
        <p className="text-body-sm text-on-surface-variant">
          {page.total} kartu cocok · menampilkan halaman {page.page} dari {page.pageCount}. Target default: ex{" "}
          {settings.exTarget}, trainer {settings.trainerTarget}. Kolom kanan tiap akun adalah target qty (kosong =
          default).
          {focusAccount && (
            <span className="ml-1 text-primary">Kolom {focusAccount.name} disorot.</span>
          )}
        </p>
      </form>

      {page.rows.length === 0 ? (
        <EmptyState
          icon="search"
          title="Tidak ada kartu yang cocok"
          description="Ubah filter atau jalankan npm run db:seed bila katalog belum terisi."
          action={
            <Link href="/inventory" className="btn-secondary">
              Reset filter
            </Link>
          }
        />
      ) : (
        <InventoryMatrix
          rows={page.rows}
          accounts={page.accounts}
          defaultTargetHint={{ ex: settings.exTarget, trainer: settings.trainerTarget }}
          focusAccountId={focusAccountId}
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <Link
          href={buildQuery(
            { q: filters.search, set: filters.setCode, kind: filters.kind, rarity: filters.rarity },
            Math.max(1, page.page - 1),
          )}
          aria-disabled={page.page <= 1}
          className={`btn-secondary ${page.page <= 1 ? "pointer-events-none opacity-40" : ""}`}
        >
          Sebelumnya
        </Link>
        <span className="font-mono text-label-md text-outline">
          {page.page} / {page.pageCount}
        </span>
        <Link
          href={buildQuery(
            { q: filters.search, set: filters.setCode, kind: filters.kind, rarity: filters.rarity },
            Math.min(page.pageCount, page.page + 1),
          )}
          aria-disabled={page.page >= page.pageCount}
          className={`btn-secondary ${page.page >= page.pageCount ? "pointer-events-none opacity-40" : ""}`}
        >
          Berikutnya
        </Link>
      </div>

      <section>
        <SectionHeading
          title="Footer matrix summary"
          subtitle="Performa akun & pemetaan stok setelah perubahan tersimpan."
          badge={`${summaries.reduce((total, summary) => total + summary.exDeficit + summary.trainerDeficit, 0)} defisit terdeteksi`}
          action={
            <Link href="/planner" className="btn-secondary">
              Buka Transfer Planner
              <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          }
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
          {summaries.map((summary) => (
            <div key={summary.account.id} className="panel p-2.5">
              <p className="truncate font-display text-xs text-on-surface">
                {summary.account.name.replace(/^Akun \d+:\s*/, "")}
              </p>
              <p className={`mt-1 font-mono text-lg ${summary.exDeficit > 0 ? "text-secondary" : "text-success"}`}>
                {summary.exCount}/{summary.account.minEx}
              </p>
              <p className="font-mono text-label-sm uppercase text-outline">
                ex · defisit <span className={summary.exDeficit > 0 ? "text-rose-300" : "text-on-surface-variant"}>{summary.exDeficit}</span>
              </p>
              <p className="font-mono text-label-sm uppercase text-outline">
                trainer <span className={summary.trainerDeficit > 0 ? "text-rose-300" : "text-on-surface-variant"}>{summary.trainerDeficit}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      <p className="panel px-3 py-2 text-body-sm text-on-surface-variant">
        <Icon name="shield" className="mr-1 inline h-3.5 w-3.5 text-success" />
        Semua perubahan qty langsung memicu kalkulasi ulang defisit/surplus dan kandidat transfer di seluruh aplikasi.
        Game tetap menjadi sumber kebenaran — koreksi manual kapan pun diperlukan.
      </p>
      {accounts.length === 0 && (
        <EmptyState
          icon="shield"
          title="Belum ada akun"
          action={
            <Link href="/settings" className="btn-primary">
              Tambah akun dulu
            </Link>
          }
        />
      )}
    </div>
  );
}
