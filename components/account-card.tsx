import Link from "next/link";
import type { Account, Card } from "@/db/schema";
import type { AccountSummary } from "@/lib/domain";
import { CardImage } from "./card-image";
import { MethodBadge, RarityChip } from "./badges";
import { Icon } from "./icon";

const statusMeta = {
  ready: { label: "Ready", className: "border-success/30 bg-success/10 text-success", note: "Memenuhi minimal ex" },
  needs: { label: "Needs ex", className: "border-secondary/35 bg-secondary/10 text-secondary", note: "Defisit ex" },
  critical: { label: "Critical", className: "border-rose-400/40 bg-rose-400/10 text-rose-200", note: "Belum punya ex" },
  untracked: {
    label: "Belum dicatat",
    className: "border-white/10 bg-white/5 text-on-surface-variant",
    note: "Koleksi belum dicatat",
  },
} as const;

export type Recommendation = {
  card: Card;
  donor: Account;
  method: "share" | "trade";
};

export function AccountCard({
  summary,
  recommendations,
}: {
  summary: AccountSummary;
  recommendations: Recommendation[];
}) {
  const meta = statusMeta[summary.status];
  const { account } = summary;
  const topSpare = summary.spare.slice(0, 3);

  return (
    <article className="panel flex flex-col overflow-hidden">
      <header className="flex items-start justify-between gap-2 px-4 pt-3">
        <p className="font-mono text-label-sm uppercase tracking-[0.14em] text-outline">
          Node {String((account.sortOrder ?? 0) + 1).padStart(2, "0")} ·{" "}
          {account.name.replace(/^Akun \d+:\s*/, "")}
        </p>
        <span className={`chip ${meta.className}`}>{meta.label}</span>
      </header>

      <div className="px-4 pt-1">
        <h3 className="font-display text-xl font-semibold leading-tight text-on-surface">{account.name}</h3>

        <div className="mt-2 flex items-end justify-between gap-2">
          <p className="font-display text-2xl font-bold text-on-surface">
            {summary.status === "untracked" ? "—" : summary.exCount}
            <span className="ml-1 text-sm font-medium text-on-surface-variant">EX unik</span>
          </p>
          <p
            className={`font-mono text-label-md ${
              summary.exDeficit > 0 ? "text-secondary" : "text-success"
            }`}
          >
            {summary.status === "untracked"
              ? "Butuh data"
              : summary.exDeficit > 0
                ? `Defisit ${summary.exDeficit}`
                : "Aman"}
            <span className="text-outline"> / min {account.minEx}</span>
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-1 flex-col gap-2 px-4">
        {recommendations.length > 0 && (
          <div className="rounded-lg border border-secondary/25 bg-secondary/[0.06] p-2">
            <p className="label-xs text-secondary">Rekomendasi terima</p>
            <ul className="mt-1 space-y-1">
              {recommendations.slice(0, 2).map((rec) => (
                <li key={`${rec.card.id}-${rec.donor.id}`} className="flex items-center gap-2">
                  <CardImage src={rec.card.imageUrl} alt={rec.card.name} className="h-9 w-7 shrink-0" sizes="28px" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-on-surface">{rec.card.name}</span>
                    <span className="block truncate font-mono text-label-sm text-outline">
                      dari {rec.donor.name.replace(/^Akun \d+:\s*/, "")}
                    </span>
                  </span>
                  <MethodBadge method={rec.method} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.status === "untracked" ? (
          <p className="rounded-md bg-white/[0.02] px-2 py-2 text-xs text-on-surface-variant">
            Koleksi akun ini belum dicatat. Buka Inventory Matrix untuk menandai kartu yang benar-benar dimiliki.
          </p>
        ) : topSpare.length > 0 ? (
          <ul className="space-y-1">
            {topSpare.map(({ card, spare }) => (
              <li key={card.id} className="flex items-center gap-2 rounded-md bg-white/[0.02] px-2 py-1">
                <span className="min-w-0 flex-1 truncate text-xs text-on-surface-variant">{card.name}</span>
                <RarityChip card={card} />
                <span className="font-mono text-label-md text-primary">×{spare}</span>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-1">
            {summary.needs.slice(0, 3).map(({ card, need }) => (
              <li key={card.id} className="flex items-center gap-2 rounded-md bg-white/[0.02] px-2 py-1">
                <span className="min-w-0 flex-1 truncate text-xs text-on-surface-variant">{card.name}</span>
                <RarityChip card={card} />
                <span className="font-mono text-label-md text-rose-300">-{need}</span>
              </li>
            ))}
            {summary.needs.length === 0 && (
              <li className="rounded-md bg-white/[0.02] px-2 py-2 text-xs text-outline">
                Belum ada target yang kurang. Catat koleksi di Inventory Matrix.
              </li>
            )}
          </ul>
        )}
      </div>

      <footer className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] px-4 py-2.5">
        <span className="font-mono text-label-sm text-outline">
          Trainer defisit <span className={summary.trainerDeficit > 0 ? "text-rose-300" : "text-success"}>{summary.trainerDeficit}</span>
          {" · "}Surplus <span className="text-primary">{summary.surplus}</span>
        </span>
        <Link
          href={`/matcher?to=${account.id}`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80"
        >
          Bantu akun ini
          <Icon name="chevronRight" className="h-3.5 w-3.5" />
        </Link>
      </footer>
    </article>
  );
}
