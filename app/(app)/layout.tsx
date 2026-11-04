import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  // Statistik shell dimuat di dalam Suspense milik AppShell, jadi layout ini
  // tidak menahan render kerangka aplikasi di belakang query ledger.
  return (
    <AppShell statsUserId={user.id} userEmail={user.email ?? ""}>
      {children}
    </AppShell>
  );
}
