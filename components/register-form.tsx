"use client";

import Link from "next/link";
import { useActionState } from "react";
import { register } from "@/app/actions";
import { Icon } from "@/components/icon";
import { useI18n } from "./i18n-provider";

export function RegisterForm({ configured, next }: { configured: boolean; next?: string }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(register, null);

  if (state?.ok) {
    return (
      <div className="space-y-4">
        <p className="flex items-start gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">
          <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0" />
          {t(state.key)}
        </p>
        <Link href="/login" className="btn-primary w-full justify-center">
          <Icon name="logout" className="h-4 w-4" />
          {t("register.loginLink")}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />

      <div className="space-y-1.5">
        <label htmlFor="email" className="label-xs block">
          {t("register.email")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          autoFocus
          className="field"
          placeholder="you@example.com"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="label-xs block">
          {t("register.password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="field"
          placeholder="••••••••"
        />
        <p className="text-xs text-outline">{t("register.passwordHint")}</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirmPassword" className="label-xs block">
          {t("register.confirmPassword")}
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="field"
          placeholder="••••••••"
        />
      </div>

      {state && !state.ok && (
        <p className="flex items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">
          <Icon name="alert" className="h-4 w-4 shrink-0" />
          {t(state.key, state.params)}
        </p>
      )}

      {!configured && (
        <p className="flex items-start gap-2 rounded-lg border border-secondary/30 bg-secondary/10 px-3 py-2 text-sm text-secondary">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          {t("login.notConfigured")}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? (
          <>
            <Icon name="repeat" className="h-4 w-4 animate-spin" />
            {t("register.pending")}
          </>
        ) : (
          <>
            <Icon name="shield" className="h-4 w-4" />
            {t("register.submit")}
          </>
        )}
      </button>

      <p className="text-center text-sm text-on-surface-variant">
        {t("register.haveAccount")}{" "}
        <Link href="/login" className="text-primary hover:underline">
          {t("register.loginLink")}
        </Link>
      </p>
    </form>
  );
}
