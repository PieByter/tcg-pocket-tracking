import Link from "next/link";
import { CardImage } from "@/components/card-image";
import { Icon } from "@/components/icon";
import { EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { loadAlbum, type AlbumCard } from "@/lib/queries";

type AlbumSection = {
  score: number;
  label: string;
  cards: AlbumCard[];
};

function groupByRarity(cards: AlbumCard[]): AlbumSection[] {
  const sections: AlbumSection[] = [];
  for (const entry of cards) {
    const last = sections.at(-1);
    if (last && last.score === entry.card.rarityScore) {
      last.cards.push(entry);
      continue;
    }
    sections.push({ score: entry.card.rarityScore, label: entry.card.rarityLabel, cards: [entry] });
  }
  return sections;
}

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("album.metaTitle") };
}

export default async function AlbumPage(props: PageProps<"/album">) {
  const user = await requireUser();
  const [searchParams, { t }] = await Promise.all([props.searchParams, getI18n()]);
  const accountParam = typeof searchParams.account === "string" ? searchParams.account : undefined;
  const album = await loadAlbum(user.id, accountParam);

  if (album.accounts.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={t("album.eyebrow")}
          title={t("album.title")}
          description={t("album.description")}
        />
        <EmptyState
          icon="shield"
          title={t("album.noAccount.title")}
          description={t("album.noAccount.body")}
          action={
            <Link href="/settings" className="btn-primary">
              {t("album.noAccount.action")}
            </Link>
          }
        />
      </div>
    );
  }

  const sections = groupByRarity(album.cards);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("album.eyebrow")}
        title={t("album.title")}
        description={t("album.description")}
        actions={
          <Link href="/inventory" className="btn-secondary">
            <Icon name="matrix" className="h-4 w-4" />
            {t("album.action.inventory")}
          </Link>
        }
      />

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {album.accounts.map((item) => {
          const active = item.id === album.account?.id;
          return (
            <Link
              key={item.id}
              href={`/album?account=${item.id}`}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 rounded-lg border px-3 py-1.5 font-display text-sm transition ${
                active
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-white/10 bg-white/5 text-on-surface-variant hover:border-primary/30 hover:text-on-surface"
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="chip border-primary/30 bg-primary/10 text-primary">
          {t("album.summary.cards", { count: album.cards.length })}
        </span>
        <span className="chip border-secondary/30 bg-secondary/10 text-secondary">
          {t("album.summary.qty", { count: album.totalQty })}
        </span>
        <span className="chip border-white/10 bg-white/5 text-on-surface-variant">
          {album.account?.name}
        </span>
      </div>

      {album.cards.length === 0 ? (
        <EmptyState
          icon="package"
          title={t("album.empty.title")}
          description={t("album.empty.body")}
          action={
            <Link href={`/inventory?account=${album.account?.id ?? ""}`} className="btn-primary">
              {t("album.empty.action")}
            </Link>
          }
        />
      ) : (
        sections.map((section) => (
          <section key={section.score}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 className="font-mono text-label-md uppercase tracking-[0.14em] text-on-surface">
                {section.label}
              </h2>
              <span className="chip border-white/10 bg-white/5 text-outline">
                {t("album.section.count", { count: section.cards.length })}
              </span>
            </div>
            <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-7 2xl:grid-cols-8">
              {section.cards.map((entry) => (
                <li key={entry.card.id} className="relative">
                  <CardImage
                    src={entry.card.imageUrl}
                    alt={entry.card.name}
                    sizes="(max-width: 640px) 30vw, (max-width: 1280px) 18vw, 150px"
                    className="aspect-[3/4] w-full"
                  />
                  <span
                    className="absolute -right-1.5 -top-1.5 min-w-6 rounded-full border border-primary/50 bg-background/90 px-1.5 py-0.5 text-center font-mono text-[11px] font-semibold leading-none text-primary shadow-[0_2px_8px_rgba(0,0,0,0.55)]"
                    title={t("album.owned", { count: entry.qty })}
                  >
                    {entry.qty}
                  </span>
                  <p
                    className="mt-1 truncate text-[11px] leading-tight text-on-surface-variant"
                    title={`${entry.card.name} · ${entry.card.setCode}`}
                  >
                    {entry.card.name}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
