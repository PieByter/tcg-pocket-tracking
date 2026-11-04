import { logout } from "@/app/actions";
import { Logo } from "./brand";
import { Icon } from "./icon";
import { ResetClock } from "./reset-clock";
import { MobileNav, SidebarNav } from "./sidebar-nav";

export type ShellStats = {
  accountsCount: number;
  trackedCount: number;
  deficitAccounts: number;
  shareUsedToday: number;
  shareCapacity: number;
  resetsInMinutes: number;
  timeZone: string;
};

export function AppShell({
  children,
  stats,
}: {
  children: React.ReactNode;
  stats: ShellStats;
}) {
  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col justify-between border-r border-white/[0.07] bg-surface-container-lowest/95 backdrop-blur-xl lg:flex">
        <div>
          <div className="flex h-20 items-center px-5">
            <Logo />
          </div>
          <div className="px-3">
            <SidebarNav />
          </div>
        </div>

        <div className="m-3 rounded-xl border border-white/10 bg-surface-container-low p-3">
          <div className="flex items-center justify-between">
            <span className="label-xs">Multi-Sync State</span>
            <span className="flex items-center gap-1.5 font-mono text-label-sm text-success">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
              LIVE
            </span>
          </div>
          <p className="mt-2 flex items-baseline justify-between font-display text-sm text-on-surface">
            Accounts locked
            <span className="font-mono text-primary">
              {stats.accountsCount} / {stats.accountsCount}
            </span>
          </p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-container-highest">
            <div className="h-full w-full bg-gradient-to-r from-primary-container to-primary" />
          </div>
          <p className="mt-2 font-mono text-label-sm text-outline">{stats.timeZone}</p>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-background/85 backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 lg:px-8">
            <div className="lg:hidden">
              <Logo compact />
            </div>

            <span className="hidden items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 font-mono text-label-sm uppercase tracking-wider text-primary sm:inline-flex">
              <Icon name="shield" className="h-3.5 w-3.5" />
              {stats.accountsCount} akun aktif · sync
            </span>

            <ResetClock initialMinutes={stats.resetsInMinutes} />

            <div className="ml-auto flex items-center gap-2">
              <span className="hidden text-right text-xs leading-tight text-on-surface-variant md:block">
                <span className="block font-display text-sm text-on-surface">Pieter</span>
                Lead Collector
              </span>
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-surface-container-high font-display text-sm text-primary">
                PT
              </span>
              <form action={logout}>
                <button
                  type="submit"
                  className="btn-ghost"
                  title="Keluar"
                  aria-label="Keluar"
                >
                  <Icon name="logout" className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>

          <div className="no-scrollbar flex items-center gap-4 overflow-x-auto border-t border-white/[0.05] bg-surface-container-lowest/60 px-4 py-2 lg:px-8">
            <RibbonItem tone="primary" label="Registry status" value={`${stats.accountsCount} akun terdaftar`} />
            <span className="h-3 w-px shrink-0 bg-white/10" />
            <RibbonItem
              tone={stats.deficitAccounts > 0 ? "warning" : "success"}
              label="Alert"
              value={
                stats.deficitAccounts > 0
                  ? `${stats.deficitAccounts} akun defisit ex`
                  : stats.trackedCount === 0
                    ? "Koleksi belum dicatat"
                    : "Semua akun memenuhi minimal ex"
              }
            />
            <span className="h-3 w-px shrink-0 bg-white/10" />
            <RibbonItem
              tone="tertiary"
              label="Kuota share hari ini"
              value={`${stats.shareUsedToday}/${stats.shareCapacity} terpakai`}
            />
            <span className="ml-auto hidden shrink-0 items-center gap-1.5 font-mono text-label-sm uppercase tracking-wider text-outline md:flex">
              <Icon name="clock" className="h-3.5 w-3.5" />
              Instant ledger sync engine
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-4 pb-28 pt-5 lg:px-8 lg:pb-12">{children}</main>
      </div>

      <MobileNav />
    </div>
  );
}

function RibbonItem({
  tone,
  label,
  value,
}: {
  tone: "primary" | "warning" | "success" | "tertiary";
  label: string;
  value: string;
}) {
  const dot = {
    primary: "bg-primary",
    warning: "bg-secondary",
    success: "bg-success",
    tertiary: "bg-tertiary",
  }[tone];

  return (
    <span className="flex shrink-0 items-center gap-2 text-xs">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className="font-mono text-label-sm uppercase tracking-wider text-outline">{label}:</span>
      <span className="text-on-surface-variant">{value}</span>
    </span>
  );
}
