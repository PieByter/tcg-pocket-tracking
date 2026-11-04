import { cache, Suspense } from "react";
import { logout } from "@/app/actions";
import { loadLedger } from "@/lib/queries";
import { getI18n } from "@/lib/i18n/server";
import { Logo } from "./brand";
import { Icon } from "./icon";
import { LanguageSwitcher } from "./language-switcher";
import { ResetClock } from "./reset-clock";
import { MobileNav, SidebarNav } from "./sidebar-nav";

type ShellStats = {
  accountsCount: number;
  trackedCount: number;
  deficitAccounts: number;
  shareUsedToday: number;
  shareCapacity: number;
  resetsInMinutes: number;
  timeZone: string;
};

/**
 * Statistik shell dimuat di dalam Suspense boundary terpisah supaya kerangka
 * aplikasi (sidebar, header, navigasi) langsung tercetak tanpa menunggu ledger.
 * Di-cache React agar sidebar, badge, jam reset, dan ribbon berbagi satu
 * `loadLedger` yang sama.
 */
const loadShellStats = cache(async (userId: string): Promise<ShellStats> => {
  const ledger = await loadLedger(userId);
  const shareUsedToday = [...ledger.usage.receivedShare.values()].reduce(
    (total, value) => total + value,
    0,
  );
  return {
    accountsCount: ledger.accounts.length,
    trackedCount: ledger.summaries.filter((summary) => summary.status !== "untracked").length,
    deficitAccounts: ledger.summaries.filter(
      (summary) => summary.status === "needs" || summary.status === "critical",
    ).length,
    shareUsedToday,
    shareCapacity: Math.max(1, ledger.accounts.length * ledger.settings.shareReceivePerDay),
    resetsInMinutes: ledger.resetsInMinutes,
    timeZone: ledger.settings.timeZone,
  };
});

export async function AppShell({
  children,
  statsUserId,
  userEmail,
}: {
  children: React.ReactNode;
  statsUserId: string;
  userEmail: string;
}) {
  const { locale, t } = await getI18n();
  const initials = (userEmail.split("@")[0] || "?").slice(0, 2).toUpperCase();

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

        <Suspense
          fallback={
            <div className="m-3 h-[136px] rounded-xl border border-white/10 bg-surface-container-low" />
          }
        >
          <SidebarSync userId={statsUserId} />
        </Suspense>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-background/85 backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 lg:px-8">
            <div className="lg:hidden">
              <Logo compact />
            </div>

            <Suspense fallback={<span className="hidden h-7 sm:inline-flex" />}>
              <HeaderStatusBadge userId={statsUserId} />
            </Suspense>

            <Suspense fallback={<span className="h-7 w-28" />}>
              <HeaderResetClock userId={statsUserId} />
            </Suspense>

            <div className="ml-auto flex items-center gap-2">
              <LanguageSwitcher locale={locale} t={t} compact />
              <span className="hidden max-w-56 text-right text-xs leading-tight text-on-surface-variant md:block">
                <span className="block truncate font-display text-sm text-on-surface">
                  {userEmail || t("shell.role")}
                </span>
                {t("shell.role")}
              </span>
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-surface-container-high font-display text-sm text-primary">
                {initials}
              </span>
              <form action={logout}>
                <button
                  type="submit"
                  className="btn-ghost"
                  title={t("shell.logout")}
                  aria-label={t("shell.logout")}
                >
                  <Icon name="logout" className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>

          <Suspense
            fallback={
              <div className="h-[38px] border-t border-white/[0.05] bg-surface-container-lowest/60" />
            }
          >
            <ShellRibbon userId={statsUserId} />
          </Suspense>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-4 pb-28 pt-5 lg:px-8 lg:pb-12">{children}</main>
      </div>

      <MobileNav />
    </div>
  );
}

async function SidebarSync({ userId }: { userId: string }) {
  const [{ t }, stats] = await Promise.all([getI18n(), loadShellStats(userId)]);

  return (
    <div className="m-3 rounded-xl border border-white/10 bg-surface-container-low p-3">
      <div className="flex items-center justify-between">
        <span className="label-xs">{t("shell.multiSync")}</span>
        <span className="flex items-center gap-1.5 font-mono text-label-sm text-success">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          {t("shell.live").toUpperCase()}
        </span>
      </div>
      <p className="mt-2 flex items-baseline justify-between font-display text-sm text-on-surface">
        {t("shell.accountsLocked")}
        <span className="font-mono text-primary">
          {stats.accountsCount} / {stats.accountsCount}
        </span>
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-container-highest">
        <div className="h-full w-full bg-gradient-to-r from-primary-container to-primary" />
      </div>
      <p className="mt-2 font-mono text-label-sm text-outline">{stats.timeZone}</p>
    </div>
  );
}

async function HeaderStatusBadge({ userId }: { userId: string }) {
  const [{ t }, stats] = await Promise.all([getI18n(), loadShellStats(userId)]);

  return (
    <span className="hidden items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 font-mono text-label-sm uppercase tracking-wider text-primary sm:inline-flex">
      <Icon name="shield" className="h-3.5 w-3.5" />
      {t("shell.accountsLive", { count: stats.accountsCount })}
    </span>
  );
}

async function HeaderResetClock({ userId }: { userId: string }) {
  const stats = await loadShellStats(userId);
  return <ResetClock initialMinutes={stats.resetsInMinutes} />;
}

async function ShellRibbon({ userId }: { userId: string }) {
  const [{ t }, stats] = await Promise.all([getI18n(), loadShellStats(userId)]);

  return (
    <div className="no-scrollbar flex items-center gap-4 overflow-x-auto border-t border-white/[0.05] bg-surface-container-lowest/60 px-4 py-2 lg:px-8">
      <RibbonItem
        tone="primary"
        label={t("shell.ribbon.registry")}
        value={t("shell.ribbon.registryValue", { count: stats.accountsCount })}
      />
      <span className="h-3 w-px shrink-0 bg-white/10" />
      <RibbonItem
        tone={stats.deficitAccounts > 0 ? "warning" : "success"}
        label={t("shell.ribbon.alert")}
        value={
          stats.deficitAccounts > 0
            ? t("shell.ribbon.deficit", { count: stats.deficitAccounts })
            : stats.trackedCount === 0
              ? t("shell.ribbon.untracked")
              : t("shell.ribbon.allMeet")
        }
      />
      <span className="h-3 w-px shrink-0 bg-white/10" />
      <RibbonItem
        tone="tertiary"
        label={t("shell.ribbon.share")}
        value={t("shell.ribbon.shareValue", {
          used: stats.shareUsedToday,
          capacity: stats.shareCapacity,
        })}
      />
      <span className="ml-auto hidden shrink-0 items-center gap-1.5 font-mono text-label-sm uppercase tracking-wider text-outline md:flex">
        <Icon name="clock" className="h-3.5 w-3.5" />
        {t("shell.ribbon.sync")}
      </span>
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
