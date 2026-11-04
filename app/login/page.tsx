import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { Logo } from "@/components/brand";
import { Icon } from "@/components/icon";
import { LanguageSwitcher } from "@/components/language-switcher";
import { passwordConfigured, readSession } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("login.metaTitle") };
}

export default async function LoginPage() {
  if (await readSession()) redirect("/");

  const { locale, t } = await getI18n();
  const features = [
    { icon: "shield" as const, label: t("login.feature.cookie") },
    { icon: "swap" as const, label: t("login.feature.atomic") },
    { icon: "planner" as const, label: t("login.feature.limits") },
  ];

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
            {t("login.eyebrow", { count: 8 })}
          </p>
          <h1 className="mt-2 font-display text-headline-lg text-on-surface">{t("login.title")}</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">{t("login.description")}</p>

          <div className="mt-5">
            <LoginForm configured={passwordConfigured()} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          {features.map((item) => (
            <div key={item.label} className="panel px-2 py-3">
              <Icon name={item.icon} className="mx-auto h-4 w-4 text-primary" />
              <p className="mt-1.5 font-mono text-label-sm text-on-surface-variant">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
