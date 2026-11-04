"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./brand";
import { Icon } from "./icon";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      <p className="px-3 pb-2 font-mono text-label-sm uppercase tracking-[0.18em] text-outline">
        Core Navigation
      </p>
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
              active
                ? "bg-primary/10 text-primary shadow-[inset_2px_0_0_0_var(--color-primary)]"
                : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
            }`}
          >
            <span
              className={`grid h-7 w-7 place-items-center rounded-md border ${
                active
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-white/10 bg-white/5 text-on-surface-variant group-hover:text-primary"
              }`}
            >
              <NavIcon name={item.icon} />
            </span>
            <span className="font-medium">{item.label}</span>          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-surface-container-lowest/95 backdrop-blur-xl lg:hidden">
      <ul className="no-scrollbar flex overflow-x-auto px-1 py-1.5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="min-w-[72px] flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[10px] font-medium transition ${
                  active ? "bg-primary/10 text-primary" : "text-on-surface-variant"
                }`}
              >
                <NavIcon name={item.icon} />
                <span>{item.short}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function NavIcon({ name }: { name: (typeof NAV_ITEMS)[number]["icon"] }) {
  return <Icon name={name} className="h-4.5 w-4.5" />;
}
