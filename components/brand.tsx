import Link from "next/link";
import type { MessageKey } from "@/lib/i18n";
import { Icon, type IconName } from "./icon";

export const NAV_ITEMS: { href: string; labelKey: MessageKey; shortKey: MessageKey; icon: IconName }[] = [
  { href: "/", labelKey: "nav.dashboard", shortKey: "nav.short.dashboard", icon: "dashboard" },
  { href: "/matcher", labelKey: "nav.matcher", shortKey: "nav.short.matcher", icon: "swap" },
  { href: "/inventory", labelKey: "nav.inventory", shortKey: "nav.short.inventory", icon: "matrix" },
  { href: "/planner", labelKey: "nav.planner", shortKey: "nav.short.planner", icon: "planner" },
  { href: "/transfers", labelKey: "nav.transfers", shortKey: "nav.short.transfers", icon: "repeat" },
  { href: "/settings", labelKey: "nav.settings", shortKey: "nav.short.settings", icon: "settings" },
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
