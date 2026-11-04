"use client";

import { useActionState } from "react";
import { login } from "@/app/actions";
import { Icon } from "@/components/icon";

export function LoginForm({ configured }: { configured: boolean }) {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="password" className="label-xs block">
          Password ledger
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          className="field font-mono tracking-widest"
          placeholder="••••••••"
        />
      </div>

      {state && !state.ok && (
        <p className="flex items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">
          <Icon name="alert" className="h-4 w-4 shrink-0" />
          {state.message}
        </p>
      )}

      {!configured && (
        <p className="flex items-start gap-2 rounded-lg border border-secondary/30 bg-secondary/10 px-3 py-2 text-sm text-secondary">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          Set <code className="font-mono">APP_PASSWORD</code> di <code className="font-mono">.env.local</code> (atau
          environment Vercel) sebelum login.
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? (
          <>
            <Icon name="repeat" className="h-4 w-4 animate-spin" />
            Memeriksa...
          </>
        ) : (
          <>
            <Icon name="shield" className="h-4 w-4" />
            Masuk ke vault
          </>
        )}
      </button>
    </form>
  );
}
