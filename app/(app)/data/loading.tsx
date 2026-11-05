import {
  Skeleton,
  SkeletonPageHeader,
  SkeletonScreen,
  SkeletonSectionHeading,
  SkeletonStatGrid,
} from "@/components/skeletons";
import { getI18n } from "@/lib/i18n/server";

export default async function DataLoading() {
  const { t } = await getI18n();

  return (
    <SkeletonScreen label={t("common.loading")} className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonStatGrid count={3} className="grid grid-cols-1 gap-3 sm:grid-cols-3" />

      <section>
        <SkeletonSectionHeading />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="panel space-y-2 p-3">
              <Skeleton className="h-7 w-7 rounded-md" />
              <Skeleton className="h-4 w-36 max-w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </section>

      <section>
        <SkeletonSectionHeading action />
        <div className="panel space-y-3 p-4">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-4 w-2/3 max-w-full" />
          <Skeleton className="h-9 w-40 rounded-lg" />
        </div>
      </section>
    </SkeletonScreen>
  );
}
