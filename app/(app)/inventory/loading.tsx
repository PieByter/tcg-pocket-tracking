import {
  Skeleton,
  SkeletonPageHeader,
  SkeletonScreen,
  SkeletonSectionHeading,
} from "@/components/skeletons";
import { getI18n } from "@/lib/i18n/server";

export default async function InventoryLoading() {
  const { t } = await getI18n();

  return (
    <SkeletonScreen label={t("common.loading")} className="space-y-5">
      <SkeletonPageHeader actions={1} />

      <div className="panel space-y-3 p-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-10 w-32 rounded-lg" />
            <Skeleton className="h-10 w-28 rounded-lg" />
            <Skeleton className="h-10 w-24 rounded-lg" />
            <Skeleton className="h-10 w-20 rounded-lg" />
          </div>
        </div>
      </div>

      <section>
        <SkeletonSectionHeading action />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="panel space-y-2 p-2.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-10" />
            </div>
          ))}
        </div>
      </section>

      <div className="panel overflow-hidden">
        <div className="hidden items-center gap-3 border-b border-white/[0.06] bg-surface-container-lowest/60 px-4 py-2.5 md:flex">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-3 flex-1" />
          ))}
        </div>
        {Array.from({ length: 10 }, (_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 border-b border-white/[0.04] px-4 py-2.5 last:border-0"
          >
            <Skeleton className="h-9 w-9 shrink-0 rounded" />
            <Skeleton className="h-3.5 w-1/3" />
            <div className="ml-auto flex gap-2">
              {Array.from({ length: 4 }, (_, cell) => (
                <Skeleton key={cell} className="h-7 w-9 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}
