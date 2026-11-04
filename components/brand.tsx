import Link from "next/link";
import { Icon, type IconName } from "./icon";

export const NAV_ITEMS: { href: string; label: string; short: string; icon: IconName }[] = [
  { href: "/", label: "Dashboard", short: "Dashboard", icon: "dashboard" },
  { href: "/matcher", label: "Transfer Matcher", short: "Matcher", icon: "swap" },
  { href: "/inventory", label: "Inventory Matrix", short: "Inventory", icon: "matrix" },
  { href: "/planner", label: "Daily Planner", short: "Planner", icon: "planner" },
  { href: "/transfers", label: "Riwayat Transfer", short: "Riwayat", icon: "repeat" },
  { href: "/settings", label: "Settings & Rules", short: "Aturan", icon: "settings" },
];

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3">
      <span className="relative grid h-10 w-10 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
        <Icon name="matrix" className="h-5 w-5" />
        <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-secondary" />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-lg font-bold tracking-tight text-on-surface">
          Pocket<span className="text-primary">Ledger</span>
        </span>
        {!compact && (
          <span className="block font-mono text-label-sm uppercase tracking-[0.18em] text-outline">
            Vault v2.4
          </span>
        )}
      </span>
    </Link>
  );
}
