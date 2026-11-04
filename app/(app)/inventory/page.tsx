import Link from "next/link";
import { InventoryMatrix } from "@/components/inventory-matrix";
import { Icon } from "@/components/icon";
import { EmptyState, PageHeader, SectionHeading } from "@/components/ui";
import { RARITY_GROUPS } from "@/lib/cards";
import { getI18n } from "@/lib/i18n/server";
import { loadInventoryPage, loadLedger } from "@/lib/queries";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("inventory.metaTitle") };
}

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
  const [searchParams, { t }] = await Promise.all([props.searchParams, getI18n()]);
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

  const kindLabels = {
    focus: t("inventory.filter.kind.focus"),
    ex: t("inventory.filter.kind.ex"),
    trainer: t("inventory.filter.kind.trainer"),
    other: t("inventory.filter.kind.other"),
    all: t("inventory.filter.kind.all"),
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("inventory.eyebrow")}
        title={t("inventory.title")}
        description={t("inventory.description")}
        actions={
          <Link href="/matcher" className="btn-secondary">
            <Icon name="swap" className="h-4 w-4" />
            {t("inventory.action.matcher")}
          </Link>
        }
      />

      <form action="/inventory" method="get" className="panel space-y-3 p-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline"
            />
            <input
              type="search"
              name="q"
              defaultValue={filters.search ?? ""}
              placeholder={t("inventory.search")}
              className="field pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select name="set" defaultValue={filters.setCode ?? "all"} className="field w-auto">
              <option value="all">{t("inventory.filter.set")}</option>
              {page.sets.map((set) => (
                <option key={set.code} value={set.code}>
                  {set.name} ({set.code})
                </option>
              ))}
            </select>
            <select name="kind" defaultValue={filters.kind} className="field w-auto">
              {(["focus", "ex", "trainer", "other", "all"] as const).map((kind) => (
                <option key={kind} value={kind}>
                  {kindLabels[kind]}
                </option>
              ))}
            </select>
            <select name="rarity" defaultValue={filters.rarity ?? "all"} className="field w-auto">
              <option value="all">{t("inventory.filter.rarity")}</option>
              {RARITY_GROUPS.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-primary">
              <Icon name="filter" className="h-4 w-4" />
              {t("inventory.filter.apply")}
            </button>
            <Link href="/inventory" className="btn-ghost">
              {t("common.reset")}
            </Link>
          </div>
        </div>
        <p className="text-body-sm text-on-surface-variant">
          {t("inventory.summary", {
            total: page.total,
            page: page.page,
            pages: page.pageCount,
            ex: settings.exTarget,
            trainer: settings.trainerTarget,
          })}
          {focusAccount && (
            <span className="ml-1 text-primary">
              {t("inventory.focus", { account: focusAccount.name })}
            </span>
          )}
        </p>
      </form>

      {page.rows.length === 0 ? (
        <EmptyState
          icon="search"
          title={t("inventory.empty.title")}
          description={t("inventory.empty.body")}
          action={
            <Link href="/inventory" className="btn-secondary">
              {t("inventory.empty.action")}
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
          {t("common.previous")}
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
          {t("common.next")}
        </Link>
      </div>

      <section>
        <SectionHeading
          title={t("inventory.footer.title")}
          subtitle={t("inventory.footer.subtitle")}
          badge={t("inventory.footer.badge", {
            count: summaries.reduce(
              (total, summary) => total + summary.exDeficit + summary.trainerDeficit,
              0,
            ),
          })}
          action={
            <Link href="/planner" className="btn-secondary">
              {t("inventory.footer.planner")}
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
              <p
                className={`mt-1 font-mono text-lg ${
                  summary.exDeficit > 0 ? "text-secondary" : "text-success"
                }`}
              >
                {summary.exCount}/{summary.account.minEx}
              </p>
              <p className="font-mono text-label-sm uppercase text-outline">
                {t("inventory.footer.ex", { count: summary.exDeficit })}
              </p>
              <p className="font-mono text-label-sm uppercase text-outline">
                {t("inventory.footer.trainer", { count: summary.trainerDeficit })}
              </p>
            </div>
          ))}
        </div>
      </section>

      <p className="panel px-3 py-2 text-body-sm text-on-surface-variant">
        <Icon name="shield" className="mr-1 inline h-3.5 w-3.5 text-success" />
        {t("inventory.note")}
      </p>
      {accounts.length === 0 && (
        <EmptyState
          icon="shield"
          title={t("inventory.noAccounts.title")}
          action={
            <Link href="/settings" className="btn-primary">
              {t("inventory.noAccounts.action")}
            </Link>
          }
        />
      )}
    </div>
  );
}
