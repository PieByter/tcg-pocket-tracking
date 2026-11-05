import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Hanya boleh dipakai dari server action / route handler.
 * Key ini melewati RLS dan bisa mengubah user mana pun — jangan pernah dikirim ke client.
 */
export function supabaseAdminConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY belum diisi di .env.local.");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
