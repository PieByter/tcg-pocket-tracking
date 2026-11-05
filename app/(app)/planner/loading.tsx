import {
  Skeleton,
  SkeletonDayPanel,
  SkeletonPageHeader,
  SkeletonScreen,
  SkeletonSectionHeading,
  SkeletonStatGrid,
} from "@/components/skeletons";
import { getI18n } from "@/lib/i18n/server";

export default async function PlannerLoading() {
  const { t } = await getI18n();

  return (
    <SkeletonScreen label={t("common.loading")} className="space-y-6">
      <SkeletonPageHeader actions={2} />
      <SkeletonStatGrid count={4} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
        <section className="space-y-4">
          <SkeletonSectionHeading action />
          <SkeletonDayPanel rows={3} />
          <SkeletonDayPanel rows={3} />
        </section>

        <aside className="space-y-3">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="panel space-y-3 p-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-5/6" />
              <Skeleton className="h-3.5 w-4/6" />
            </div>
          ))}
        </aside>
      </div>
    </SkeletonScreen>
  );
}
