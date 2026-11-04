import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { Logo } from "@/components/brand";
import { Icon } from "@/components/icon";
import { passwordConfigured, readSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Masuk — PocketLedger",
};

export default async function LoginPage() {
  if (await readSession()) redirect("/");

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Logo />
        </div>

        <div className="panel-raised p-6">
          <p className="label-xs flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Vault privat · 8 akun
          </p>
          <h1 className="mt-2 font-display text-headline-lg text-on-surface">Ledger Collector</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Data koleksi dan riwayat transfer tersimpan di Supabase dan hanya bisa diakses dengan password ini.
          </p>

          <div className="mt-5">
            <LoginForm configured={passwordConfigured()} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { icon: "shield", label: "Cookie HttpOnly" },
            { icon: "swap", label: "Transfer atomik" },
            { icon: "planner", label: "Batas harian" },
          ].map((item) => (
            <div key={item.label} className="panel px-2 py-3">
              <Icon
                name={item.icon as "shield" | "swap" | "planner"}
                className="mx-auto h-4 w-4 text-primary"
              />
              <p className="mt-1.5 font-mono text-label-sm text-on-surface-variant">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
