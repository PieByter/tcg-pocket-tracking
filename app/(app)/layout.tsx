import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { loadLedger } from "@/lib/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const ledger = await loadLedger(user.id);

  const shareUsedToday = [...ledger.usage.receivedShare.values()].reduce((total, value) => total + value, 0);
  const deficitAccounts = ledger.summaries.filter(
    (summary) => summary.status === "needs" || summary.status === "critical",
  ).length;

  return (
    <AppShell
      userEmail={user.email ?? ""}
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
