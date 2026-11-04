import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand";
import { Icon } from "@/components/icon";
import { LanguageSwitcher } from "@/components/language-switcher";
import { RegisterForm } from "@/components/register-form";
import { readSession } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { supabaseConfigured } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("register.metaTitle") };
}

export default async function RegisterPage(props: PageProps<"/register">) {
  if (await readSession()) redirect("/");

  const [searchParams, { locale, t }] = await Promise.all([props.searchParams, getI18n()]);
  const next = typeof searchParams.next === "string" ? searchParams.next : undefined;
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
            {t("register.eyebrow")}
          </p>
          <h1 className="mt-2 font-display text-headline-lg text-on-surface">{t("register.title")}</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">{t("register.description")}</p>

          <div className="mt-5">
            <RegisterForm configured={supabaseConfigured()} next={next} />
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
