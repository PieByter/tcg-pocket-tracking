/**
 * Header internal yang diisi `proxy.ts` setelah sesi diverifikasi ke Supabase Auth.
 *
 * Tujuannya agar render server tidak memanggil Supabase Auth untuk kedua kalinya.
 * `proxy.ts` selalu menghapus nilai kiriman klien lalu mengisinya hanya dari hasil
 * `getUser()` yang sudah terverifikasi, jadi header ini tidak bisa dipalsukan.
 *
 * Modul ini sengaja tidak memakai `server-only` karena diimpor oleh middleware.
 */
export const AUTH_USER_ID_HEADER = "x-pl-auth-user-id";
export const AUTH_USER_EMAIL_HEADER = "x-pl-auth-user-email";
