import {
  Skeleton,
  SkeletonList,
  SkeletonPageHeader,
  SkeletonScreen,
  SkeletonSectionHeading,
  SkeletonStatGrid,
} from "@/components/skeletons";
import { getI18n } from "@/lib/i18n/server";

export default async function DashboardLoading() {
  const { t } = await getI18n();

  return (
    <SkeletonScreen label={t("common.loading")} className="space-y-8">
      <SkeletonPageHeader actions={3} />
      <SkeletonStatGrid count={4} />

      <section>
        <SkeletonSectionHeading action />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="panel space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-6 w-16 rounded" />
              </div>
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </section>

      <section>
        <SkeletonSectionHeading action />
        <SkeletonList rows={6} />
      </section>
    </SkeletonScreen>
  );
}
