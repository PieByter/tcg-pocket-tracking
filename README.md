# PocketLedger — TCG Pocket Multi-Account Tracker

Ledger dan planner perpindahan kartu untuk banyak akun **Pokémon TCG Pocket**. Aplikasi ini **pencatat dan perencana**, bukan integrasi ke game: tidak ada API resmi, dan aplikasi tidak pernah menyimpan kredensial game.

Dibangun sesuai [PRD.md](./PRD.md) dan mengikuti design system PocketLedger di [stitch_pocket_trade_ledger/pocketledger/DESIGN.md](./stitch_pocket_trade_ledger/pocketledger/DESIGN.md).

## Fitur

- **Dashboard** — ringkasan defisit ex per akun, surplus yang bisa dilepas, kuota harian, dan aktivitas transfer terbaru.
- **Transfer Matcher** — pilih akun penerima (defisit) dan pemberi (surplus); kandidat dihitung dari kepemilikan, target, dan aturan minimal ex. Badge **Share** / **Trade**, saran kartu pengganti rarity sama, serta sisa kuota hari ini.
- **Inventory Matrix** — edit qty dan target per akun langsung di tabel 8 kolom, simpan sebagai satu batch, dengan pencarian dan filter set/rarity/jenis.
- **Daily Transfer Planner** — jadwal greedy multi-hari untuk menutup defisit ex lalu trainer, mematuhi batas Share per akun, limit pasangan, kuota Trade, serta sisa Stamina & Shinedust tiap akun. Slot yang sudah cocok bisa langsung dijadwalkan ke ledger: **Terapkan hari ini** atau **Terapkan semua N hari** (idempoten — klik ulang tidak menggandakan transfer).
- **Riwayat Transfer** — status `planned → sent → confirmed | cancelled`. Konfirmasi memperbarui kedua akun dalam satu transaksi dan idempoten.
- **Stamina & Shinedust** — diisi manual per akun (menyimpan nilai baru mereset timer regen), lalu diperkirakan naik 1 stamina setiap `trade.stamina_regen_hours` (default 24 jam) sampai batas `trade.max_stamina` (default 10). Kandidat dan planner memblokir trade bila stamina pemberi habis atau Shinedust tidak cukup.
- **Settings & Rules** — CRUD akun (`min_ex`, friend code, stamina, Shinedust) dan semua parameter game (batas Share, kuota Trade, cooldown, jam reset, zona waktu, biaya Shinedust, regen stamina).
- **PWA** — installable di Android/iOS/desktop, manifest + service worker (cache-first untuk aset statis & thumbnail, halaman offline dua bahasa), dan thumbnail kartu dengan skeleton + lazy loading.

## Stack

| Layer | Pilihan |
| --- | --- |
| App | Next.js 16 App Router (Server Components + Server Actions), React 19, Tailwind v4 |
| DB | Supabase Postgres (production) / **PGlite** embedded Postgres (lokal, tanpa setup) |
| ORM | Drizzle ORM + `postgres.js` (`prepare: false` untuk transaction pooler Supabase) |
| Auth | Password tunggal + cookie HttpOnly bertanda tangan HMAC (`node:crypto`) |
| Deploy | Vercel |
| Test | Vitest untuk fungsi murni (kandidat, planner, game day) |

## Menjalankan lokal

Tidak perlu Supabase. Tanpa `DATABASE_URL`, aplikasi memakai PGlite (Postgres WASM) di `.data/pocketledger`.

```bash
npm install
cp .env.example .env.local   # isi APP_PASSWORD & AUTH_SECRET
npm run db:seed              # katalog kartu + 8 akun default + config default
npm run dev
```

`npm run db:seed:demo` menambahkan koleksi contoh agar dashboard/matcher/planner langsung terlihat berisi. Seed demo hanya jalan saat tabel holdings masih kosong.

Buka <http://localhost:3000> dan login dengan `APP_PASSWORD`.

## Setup Supabase + Vercel

1. **Buat project Supabase** (region terdekat, mis. Singapore).
2. **Ambil connection string** di *Project Settings → Database*:
   - `DATABASE_URL` → **Connection pooling / Transaction mode**, port `6543`, tambahkan `?sslmode=require`.
   - `DIRECT_URL` → **Direct connection**, port `5432` (dipakai migrasi `drizzle-kit`).
3. **Jalankan migrasi** dari mesin lokal:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```
   Alternatif: `npm run db:push` untuk menyamakan skema tanpa file migrasi.
4. **Deploy ke Vercel**, lalu set environment variables:

   | Variable | Wajib | Keterangan |
   | --- | --- | --- |
   | `DATABASE_URL` | ya | Postgres pooler Supabase (`prepare: false` sudah diset otomatis) |
   | `APP_PASSWORD` | ya | Password halaman login |
   | `AUTH_SECRET` | ya | String acak ≥ 16 karakter untuk menandatangani cookie sesi |
   | `DIRECT_URL` | tidak | Hanya untuk `drizzle-kit` di lokal/CI |
   | `ALLOW_LOCAL_DB` | tidak | `1` untuk mengizinkan PGlite saat `NODE_ENV=production` (hanya uji lokal) |

   Tidak ada satu pun variabel yang diekspos ke browser.
5. **Amankan database**: aplikasi mengakses Postgres langsung dari server (tanpa `anon key` di browser), jadi RLS tidak dipakai. Tetap disarankan:
   ```sql
   alter table public.accounts   enable row level security;
   alter table public.cards      enable row level security;
   alter table public.holdings   enable row level security;
   alter table public.transfers  enable row level security;
   alter table public.app_config enable row level security;
   -- tanpa policy => tidak ada akses lewat PostgREST/anon key
   ```
   Koneksi aplikasi memakai user `postgres`/service yang melewati RLS.

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Dev server (PGlite bila `DATABASE_URL` kosong) |
| `npm run build` / `npm start` | Build & jalankan produksi |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Unit test Vitest |
| `npm run catalog:build` | Regenerasi `data/catalog.json` dari dataset komunitas |
| `npm run db:generate` | Generate migrasi SQL baru dari `db/schema.ts` |
| `npm run db:migrate` | Terapkan migrasi ke `DIRECT_URL`/`DATABASE_URL` |
| `npm run db:push` | Sinkronkan skema langsung (tanpa file migrasi) |
| `npm run db:seed` | Upsert katalog kartu + akun default + config |
| `npm run db:seed:demo` | Seed + isi koleksi contoh |
| `npm run icons:build` | Regenerasi ikon PWA di `public/icons/` (butuh `sharp`) |

## Bahasa / Language

Aplikasi mendukung **English (default)** dan **Bahasa Indonesia**. Pilihan bahasa disimpan di cookie `pocketledger_locale` (`en` | `id`), bukan di URL, sehingga tidak ada duplikasi route.

- Tanpa cookie, UI tampil dalam English.
- Tombol **EN / ID** ada di header aplikasi dan di halaman login.
- Semua teks — termasuk pesan Server Action, alasan planner, dan label status — ada di kamus:
  - [lib/i18n/en.ts](./lib/i18n/en.ts) — sumber kebenaran untuk daftar key.
  - [lib/i18n/id.ts](./lib/i18n/id.ts) — bertipe `Record<MessageKey, string>`, jadi key yang hilang/berlebih langsung gagal type-check.
- Tanggal dan angka mengikuti locale (`en-GB` / `id-ID`).
- Server Component memakai `getI18n()` ([lib/i18n/server.ts](./lib/i18n/server.ts)), Client Component memakai `useI18n()` dari [components/i18n-provider.tsx](./components/i18n-provider.tsx).

Menambah bahasa baru: buat `lib/i18n/<kode>.ts` dengan semua key, daftarkan di `LOCALES` + `dictionaries` ([lib/i18n/index.ts](./lib/i18n/index.ts)), dan perluas tipe `Locale`.

## PWA & optimasi gambar

- `app/manifest.ts` menyajikan `/manifest.webmanifest`; ikon 192/512 + maskable dan `apple-touch-icon` ada di `public/icons/` (dibuat oleh `npm run icons:build` memakai `sharp`).
- `public/sw.js` didaftarkan [components/service-worker.tsx](./components/service-worker.tsx) **hanya pada build produksi**. Strategi: cache-first untuk `/_next/static/*` dan thumbnail `raw.githubusercontent.com` (maksimal 500 entri), navigasi network-only dengan fallback halaman offline bilingual. Naikkan `CACHE_VERSION` di `sw.js` bila perlu memaksa refresh cache.
- Thumbnail memakai [components/card-image.tsx](./components/card-image.tsx): skeleton shimmer, fade-in saat load, fallback ikon bila gambar gagal, `loading="lazy"` + `decoding="async"`, dan `priority` untuk beberapa baris pertama (LCP).
- Optimasi gambar Next (`/_next/image`) **dimatikan secara default** agar kuota Vercel Image Optimization tidak jebol — gambar diambil langsung dari GitHub. Set `NEXT_IMAGE_OPTIMIZED=1` untuk mengaktifkannya.

## Struktur

```
app/
  (app)/layout.tsx        shell + proteksi sesi
  (app)/page.tsx          dashboard defisit & surplus
  (app)/matcher/          transfer matcher
  (app)/inventory/        inventory matrix
  (app)/planner/          daily transfer planner
  (app)/transfers/        riwayat & aksi status
  (app)/settings/         akun + aturan
  login/                  halaman login
  manifest.ts             manifest PWA
  actions.ts              seluruh Server Actions (mutasi)
components/               UI (design system PocketLedger)
public/
  sw.js                   service worker (cache aset + halaman offline)
  icons/                  ikon PWA hasil `npm run icons:build`
db/
  schema.ts               Drizzle schema (accounts, cards, holdings, transfers, app_config)
  index.ts                driver Postgres (Supabase) atau PGlite (lokal)
lib/
  domain.ts               analisis akun, kuota harian, kandidat transfer (pure)
  planner.ts              greedy multi-day planner (pure)
  resources.ts            estimasi stamina & Shinedust per akun (pure)
  cards.ts                rarity/kind/target helpers
  game-day.ts             perhitungan hari reset + zona waktu
  settings.ts             default & parsing konfigurasi
  queries.ts              query baca (ledger, inventory)
  auth.ts / session.ts    sesi cookie
  i18n/                   kamus EN/ID + helper server & tipe
drizzle/                  migrasi SQL hasil drizzle-kit
data/catalog.json         katalog kartu (seed)
scripts/                  build-catalog, seed
tests/                    unit test fungsi murni
proxy.ts                  redirect optimistik ke /login
```

## Model & aturan yang ditegakkan

- `holdings.qty >= 0` dan `target_qty >= 0` (CHECK constraint).
- Transfer harus antar akun berbeda, metode hanya `share`/`trade`, trade wajib punya `card_in_id` (CHECK constraint).
- **Batas harian ditegakkan di server** saat *Tandai terkirim* dan dicek ulang di dalam transaksi saat *Konfirmasi*:
  - Share: maksimal `share.receive_per_day` penerimaan per akun per game day, dan `share.send_per_pair_per_day` kiriman per pasangan akun.
  - Trade: `trade.per_account_per_day` per akun per hari + cooldown `trade.pair_cooldown_days` per pasangan.
- Konfirmasi mengunci baris transfer + baris akun (`SELECT … FOR UPDATE`), memindahkan stok, dan menandai `confirmed` dalam satu transaksi. Konfirmasi ulang tidak memindahkan dua kali (idempoten).
- Semua parameter disimpan di `app_config` dan dapat diubah dari halaman Settings — bukan hardcode.
- Kartu 3★/Immersive/Crown tidak `shareable` maupun `tradable` menurut dataset sehingga tidak pernah muncul sebagai kandidat atau jadwal.

## Sumber data katalog

[`pokemon-tcg-pocket-database`](https://github.com/flibustier/pokemon-tcg-pocket-database) (komunitas) untuk set, nomor, nama, rarity, tipe; gambar thumbnail dari [`pokemon-tcg-exchange`](https://github.com/flibustier/pokemon-tcg-exchange). URL gambar dipakai langsung (tidak disalin) agar mudah diperbarui dan tidak memakan storage. Untuk set baru: `npm run catalog:build && npm run db:seed` — kepemilikan yang ada tidak berubah karena seed bersifat upsert per `card.id`.

> Proyek ini tidak berafiliasi dengan Nintendo, Creatures, Game Freak, atau The Pokémon Company. Gunakan hanya untuk koleksi pribadi.

## Catatan

- Reset harian default pukul **04:00 Asia/Jakarta**; jam reset sebenarnya belum dipastikan, ubah di Settings.
- `min_ex` per akun default 2. Perhitungan "ex unik" default per **nama kartu** (alt-art tidak menambah); bisa diubah ke per cetakan di Settings.
- Batas trade 5/akun/hari adalah asumsi pemilik dan belum diverifikasi; semuanya konfigurasi.
- Stamina & Shinedust dicatat manual dan diperkirakan dari waktu update terakhir; pemblokiran dihitung dari **stamina pemberi** saja (game bisa saja membebankan kedua sisi). Regen 24 jam dan maksimal 10 stamina juga asumsi — ubah di Settings.
- Aplikasi tidak menyimpan kredensial game dan tidak melakukan otomasi ke game.
