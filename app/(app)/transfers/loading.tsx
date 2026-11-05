import {
  SkeletonList,
  SkeletonPageHeader,
  SkeletonScreen,
  SkeletonSectionHeading,
  SkeletonStatGrid,
} from "@/components/skeletons";
import { getI18n } from "@/lib/i18n/server";

export default async function TransfersLoading() {
  const { t } = await getI18n();

  return (
    <SkeletonScreen label={t("common.loading")} className="space-y-5">
      <SkeletonPageHeader actions={1} />

      <SkeletonStatGrid count={4} className="grid grid-cols-2 gap-3 lg:grid-cols-4" />

      <section>
        <SkeletonSectionHeading action />
        <SkeletonList rows={8} />
      </section>
    </SkeletonScreen>
  );
}
