"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/actions";
import { Icon } from "@/components/icon";
import { useI18n } from "./i18n-provider";

export function ChangePasswordForm() {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(changePassword, null);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="change-password" className="label-xs block">
            {t("settings.security.new")}
          </label>
          <input
            id="change-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="field"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="change-confirm" className="label-xs block">
            {t("settings.security.confirm")}
          </label>
          <input
            id="change-confirm"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="field"
          />
        </div>
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

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? (
          <>
            <Icon name="repeat" className="h-4 w-4 animate-spin" />
            {t("common.saving")}
          </>
        ) : (
          <>
            <Icon name="shield" className="h-4 w-4" />
            {t("settings.security.save")}
          </>
        )}
      </button>
    </form>
  );
}
