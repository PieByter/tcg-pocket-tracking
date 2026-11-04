import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient, supabaseConfigured } from "./supabase/server";

/** Ambil user aktif sekali per request (cache React). */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  if (!supabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
});

export async function readSession(): Promise<boolean> {
  return Boolean(await getCurrentUser());
}

export async function requireUser(): Promise<User> {
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
