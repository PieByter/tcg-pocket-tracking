import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, supabaseConfigured } from "./supabase/server";
import { AUTH_USER_EMAIL_HEADER, AUTH_USER_ID_HEADER } from "./auth-headers";

/** Bagian user yang dipakai aplikasi. */
export type SessionUser = {
  id: string;
  email: string | null;
};

/**
 * Ambil user aktif sekali per request (cache React).
 *
 * `proxy.ts` sudah memverifikasi sesi ke Supabase pada request yang sama dan
 * meneruskan hasilnya lewat header internal, jadi render server cukup membacanya
 * — tidak perlu `getUser()` kedua yang menambah satu round-trip jaringan.
 * Fallback `getUser()` tetap dipakai bila header tidak ada (mis. request yang
 * tidak melewati proxy).
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  if (!supabaseConfigured()) return null;

  const requestHeaders = await headers();
  const verifiedId = requestHeaders.get(AUTH_USER_ID_HEADER);
  if (verifiedId) {
    return { id: verifiedId, email: requestHeaders.get(AUTH_USER_EMAIL_HEADER) || null };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
});

export async function readSession(): Promise<boolean> {
  return Boolean(await getCurrentUser());
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireUserId(): Promise<string> {
  const user = await requireUser();
  return user.id;
}

export async function requireSession(): Promise<void> {
  await requireUser();
}
