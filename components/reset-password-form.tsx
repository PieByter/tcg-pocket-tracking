"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPassword } from "@/app/actions";
import { Icon } from "@/components/icon";
import { useI18n } from "./i18n-provider";

export function ResetPasswordForm({ configured }: { configured: boolean }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(resetPassword, null);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="reset-email" className="label-xs block">
          {t("reset.email")}
        </label>
        <input
          id="reset-email"
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
        <label htmlFor="reset-password" className="label-xs block">
          {t("reset.newPassword")}
        </label>
        <input
          id="reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="field"
          placeholder="••••••••"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="reset-confirm" className="label-xs block">
          {t("reset.confirmPassword")}
        </label>
        <input
          id="reset-confirm"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
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

      {state?.ok && (
        <p className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          <Icon name="check" className="h-4 w-4 shrink-0" />
          {t(state.key)}
        </p>
      )}

      {!configured && (
        <p className="flex items-start gap-2 rounded-lg border border-secondary/30 bg-secondary/10 px-3 py-2 text-sm text-secondary">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          {t("reset.notConfigured")}
        </p>
      )}

      <p className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs leading-relaxed text-on-surface-variant">
        <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" />
        {t("reset.warning")}
      </p>

      <button type="submit" disabled={pending || !configured} className="btn-primary w-full">
        {pending ? (
          <>
            <Icon name="repeat" className="h-4 w-4 animate-spin" />
            {t("reset.pending")}
          </>
        ) : (
          <>
            <Icon name="shield" className="h-4 w-4" />
            {t("reset.submit")}
          </>
        )}
      </button>

      <p className="text-center text-sm text-on-surface-variant">
        <Link href="/login" className="text-primary hover:underline">
          {t("reset.backToLogin")}
        </Link>
      </p>
    </form>
  );
}
