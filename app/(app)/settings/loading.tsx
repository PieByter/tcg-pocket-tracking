import {
  Skeleton,
  SkeletonField,
  SkeletonPageHeader,
  SkeletonScreen,
  SkeletonSectionHeading,
  SkeletonStatGrid,
} from "@/components/skeletons";
import { getI18n } from "@/lib/i18n/server";

export default async function SettingsLoading() {
  const { t } = await getI18n();

  return (
    <SkeletonScreen label={t("common.loading")} className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonStatGrid count={3} className="grid grid-cols-1 gap-3 sm:grid-cols-3" />

      <section>
        <SkeletonSectionHeading action />
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="panel space-y-3 p-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-7 rounded-md" />
                <Skeleton className="h-4 w-40 max-w-full" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SkeletonField />
                <SkeletonField />
              </div>
              <Skeleton className="h-9 w-28 rounded-lg" />
            </div>
          ))}
        </div>
      </section>

      <section>
        <SkeletonSectionHeading />
        <div className="panel space-y-4 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <SkeletonField key={index} />
            ))}
          </div>
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </section>
    </SkeletonScreen>
  );
}
