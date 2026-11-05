import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { Logo } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getI18n } from "@/lib/i18n/server";
import { supabaseAdminConfigured } from "@/lib/supabase/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("reset.metaTitle") };
}

export default async function ResetPasswordPage() {
  const { locale, t } = await getI18n();

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Logo />
          <LanguageSwitcher locale={locale} t={t} compact />
        </div>

        <div className="panel-raised p-6">
          <p className="label-xs flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {t("reset.eyebrow")}
          </p>
          <h1 className="mt-2 font-display text-headline-lg text-on-surface">{t("reset.title")}</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">{t("reset.description")}</p>

          <div className="mt-5">
            <ResetPasswordForm configured={supabaseAdminConfigured()} />
          </div>
        </div>
      </div>
    </div>
  );
}
