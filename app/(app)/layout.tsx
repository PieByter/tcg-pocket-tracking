import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";
import { loadLedger } from "@/lib/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  const ledger = await loadLedger();

  const shareUsedToday = [...ledger.usage.receivedShare.values()].reduce((total, value) => total + value, 0);
  const deficitAccounts = ledger.summaries.filter(
    (summary) => summary.status === "needs" || summary.status === "critical",
  ).length;

  return (
    <AppShell
      stats={{
        accountsCount: ledger.accounts.length,
        trackedCount: ledger.summaries.filter((summary) => summary.status !== "untracked").length,
        deficitAccounts,
        shareUsedToday,
        shareCapacity: Math.max(1, ledger.accounts.length * ledger.settings.shareReceivePerDay),
        resetsInMinutes: ledger.resetsInMinutes,
        timeZone: ledger.settings.timeZone,
      }}
    >
      {children}
    </AppShell>
  );
}
