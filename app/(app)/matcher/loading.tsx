import {
  Skeleton,
  SkeletonList,
  SkeletonPageHeader,
  SkeletonScreen,
  SkeletonSectionHeading,
  SkeletonStatGrid,
} from "@/components/skeletons";
import { getI18n } from "@/lib/i18n/server";

export default async function MatcherLoading() {
  const { t } = await getI18n();

  return (
    <SkeletonScreen label={t("common.loading")} className="space-y-6">
      <SkeletonPageHeader actions={1} />

      <div className="panel-raised space-y-3 p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-white/[0.07] pt-3 sm:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-12" />
            </div>
          ))}
        </div>
      </div>

      <SkeletonStatGrid count={4} />

      <section>
        <SkeletonSectionHeading action />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="panel space-y-3 p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </section>

      <section>
        <SkeletonSectionHeading />
        <SkeletonList rows={3} />
      </section>
    </SkeletonScreen>
  );
}
