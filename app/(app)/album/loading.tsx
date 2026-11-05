import { Skeleton, SkeletonPageHeader, SkeletonScreen } from "@/components/skeletons";
import { getI18n } from "@/lib/i18n/server";

export default async function AlbumLoading() {
  const { t } = await getI18n();

  return (
    <SkeletonScreen label={t("common.loading")} className="space-y-5">
      <SkeletonPageHeader actions={1} />

      <div className="flex gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-28 rounded-lg" />
        ))}
      </div>

      <div className="flex gap-2">
        <Skeleton className="h-6 w-28 rounded" />
        <Skeleton className="h-6 w-28 rounded" />
      </div>

      <Skeleton className="h-4 w-40" />
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-7 2xl:grid-cols-8">
        {Array.from({ length: 21 }, (_, index) => (
          <div key={index} className="space-y-1">
            <Skeleton className="aspect-[3/4] w-full rounded-md" />
            <Skeleton className="h-2.5 w-3/4" />
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}
