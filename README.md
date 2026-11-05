# PocketLedger — TCG Pocket Multi-Account Tracker

Ledger dan planner perpindahan kartu untuk banyak akun **Pokémon TCG Pocket**. Aplikasi ini **pencatat dan perencana**, bukan integrasi ke game: tidak ada API resmi, dan aplikasi tidak pernah menyimpan kredensial game.

## Fitur

- **Dashboard** — ringkasan defisit ex per akun, surplus yang bisa dilepas, kuota harian, dan aktivitas transfer terbaru.
- **Transfer Matcher** — pilih akun penerima (defisit) dan pemberi (surplus); kandidat dihitung dari kepemilikan, target, dan aturan minimal ex. Badge **Share** / **Trade**, saran kartu pengganti rarity sama, serta sisa kuota hari ini.
- **Inventory Matrix** — edit qty dan target per akun langsung di tabel 8 kolom, simpan sebagai satu batch, dengan pencarian dan filter set/rarity/jenis.
- **Daily Transfer Planner** — jadwal greedy multi-hari untuk menutup defisit ex lalu trainer, mematuhi batas Share per akun, limit pasangan, kuota Trade, serta sisa Stamina & Shinedust tiap akun. Slot yang sudah cocok bisa langsung dijadwalkan ke ledger: **Terapkan hari ini** atau **Terapkan semua N hari** (idempoten — klik ulang tidak menggandakan transfer).
- **Riwayat Transfer** — status `planned → sent → confirmed | cancelled`. Konfirmasi memperbarui kedua akun dalam satu transaksi dan idempoten.
- **Stamina & Shinedust** — diisi manual per akun (menyimpan nilai baru mereset timer regen), lalu diperkirakan naik 1 stamina setiap `trade.stamina_regen_hours` (default 24 jam) sampai batas `trade.max_stamina` (default 10). Kandidat dan planner memblokir trade bila stamina pemberi habis atau Shinedust tidak cukup.
- **Settings & Rules** — CRUD akun (`min_ex`, friend code, stamina, Shinedust) dan semua parameter game (batas Share, kuota Trade, cooldown, jam reset, zona waktu, biaya Shinedust, regen stamina).
- **PWA** — installable di Android/iOS/desktop, manifest + service worker (cache-first untuk aset statis & thumbnail, halaman offline dua bahasa), dan thumbnail kartu dengan skeleton + lazy loading.
- **Export & import** — halaman *Data & Backup*: unduh backup JSON lengkap, koleksi (CSV), dan riwayat transfer (CSV); impor koleksi massal dari CSV/tempelan dengan mode ganti atau tambah, plus pratinjau diff sebelum menulis.

## Stack

| Layer | Pilihan |
| --- | --- |
| App | Next.js 16 App Router (Server Components + Server Actions), React 19, Tailwind v4 |
| DB | Supabase Postgres (production) / **PGlite** embedded Postgres (lokal, tanpa setup DB) |
| ORM | Drizzle ORM + `postgres.js` (`prepare: false` untuk transaction pooler Supabase) |
| Auth | Supabase Auth (email + password) dengan cookie SSR `@supabase/ssr` |
| Multi-user | Tiap user punya ledger sendiri (`user_id` di `accounts`, `transfers`, `app_config`) |
| Deploy | Vercel |
| Test | Vitest untuk fungsi murni (kandidat, planner, game day) |

## Menjalankan lokal

Login memakai **Supabase Auth**, jadi project Supabase tetap dibutuhkan. Kalau `DATABASE_URL` kosong, data ledger disimpan di PGlite lokal (`.data/pocketledger`), tetapi autentikasi tetap ke Supabase.

1. Aktifkan **Authentication → Providers → Email** di dashboard Supabase.
2. Isi **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`
3. Siapkan env dan jalankan:

```bash
npm install
cp .env.example .env.local   # isi NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, DATABASE_URL
npm run db:migrate           # atau npm run db:push untuk database baru
npm run dev
```

4. Buka <http://localhost:3000/register>, daftar, lalu konfirmasi email. Buka link konfirmasi di browser yang sama dengan proses daftar (verifier PKCE disimpan di cookie); kalau link dibuka di perangkat lain, cukup login manual setelah email terkonfirmasi.
5. Isi `SEED_USER_EMAIL` di `.env.local` dengan email tadi, lalu seed katalog:

```bash
npm run db:seed              # katalog kartu + 8 akun default + config default
```

`npm run db:seed:demo` menambahkan koleksi contoh agar dashboard/matcher/planner langsung terlihat berisi. Seed demo hanya jalan saat tabel holdings user itu masih kosong.

### Memindahkan data lokal lama

Kalau sebelumnya sudah memakai PGlite dan ingin membawanya ke Supabase:

```bash
SEED_USER_EMAIL="you@example.com" npm run db:migrate:local
```

Skrip ini menyalin `accounts`, `holdings`, `transfers`, dan `app_config` dari `.data/pocketledger` ke user tersebut. Data user itu di Supabase diganti (bukan digabung). Jalankan `npm run db:seed` lebih dulu supaya katalog kartu tersedia.

### Kalau `db:seed` dijalankan tanpa `SEED_USER_EMAIL`

Hanya katalog kartu yang di-upsert; 8 akun default dan config dilewati. Ini berguna saat pertama kali menyiapkan project, sebelum ada user terdaftar.

## Setup Supabase + Vercel

1. **Buat project Supabase** (region terdekat, mis. Singapore).
2. **Ambil kredensial**:
   - *Project Settings → API*: `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable/anon key — nilainya memang publik).
   - *Project Settings → Database*: pakai **Pooler** untuk kedua URL. Host `db.<ref>.supabase.co` sekarang hanya punya record IPv6, jadi tidak bisa dipakai dari jaringan IPv4-only.
     - `DATABASE_URL` → **Transaction mode**, port `6543`, user `postgres.<ref>`.
     - `DIRECT_URL` → **Session mode**, port `5432`, user `postgres.<ref>` (dipakai `drizzle-kit`).
3. **Atur Auth** di *Authentication*:
   - Aktifkan provider **Email**.
   - *URL Configuration → Site URL*: `https://<domain-vercel-kamu>`.
   - *Redirect URLs*: `https://<domain-vercel-kamu>/auth/callback` (tambahkan juga `http://localhost:3000/auth/callback` untuk lokal).
4. **Jalankan migrasi** dari mesin lokal:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```
   Alternatif: `npm run db:push` untuk menyamakan skema tanpa file migrasi.
5. **Deploy ke Vercel**, lalu set environment variables:

   | Variable | Wajib | Keterangan |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | ya | Project URL Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ya | anon/publishable key (memang publik, hanya untuk Auth) |
   | `DATABASE_URL` | ya | Pooler Transaction mode (port `6543`), user `postgres.<ref>`; `prepare: false` sudah diset otomatis |
   | `DIRECT_URL` | tidak | Pooler Session mode (port `5432`), hanya untuk `drizzle-kit` di lokal/CI |
   | `SEED_USER_EMAIL` | tidak | Email user untuk `db:seed` / `db:migrate:local` |
   | `ALLOW_LOCAL_DB` | tidak | `1` untuk mengizinkan PGlite saat `NODE_ENV=production` (hanya uji lokal) |

   `NEXT_PUBLIC_*` memang ikut ke browser; token sesi tetap disimpan sebagai cookie HttpOnly oleh `@supabase/ssr`.
6. **Amankan database**: aplikasi mengakses Postgres langsung dari server dan memfilter semua query dengan `user_id`. Sebagai lapisan tambahan, aktifkan RLS agar `anon key` tidak bisa membaca tabel lewat PostgREST:
   ```sql
   alter table public.accounts   enable row level security;
   alter table public.cards      enable row level security;
   alter table public.holdings   enable row level security;
   alter table public.transfers  enable row level security;
   alter table public.app_config enable row level security;
   -- tanpa policy => tidak ada akses lewat PostgREST/anon key
   ```
   Koneksi aplikasi memakai user `postgres`/service yang melewati RLS, jadi isolasi per user dijaga oleh query aplikasi.

### Reset password tanpa email

Halaman `/reset-password` (link **Lupa password?** di halaman login) langsung mengganti password lewat Supabase Admin API — tidak ada email yang dikirim. Syaratnya `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API → secret key) tersedia di environment server; key ini tidak pernah dikirim ke browser.

> **Peringatan:** dengan konfigurasi ini siapa pun yang tahu sebuah email bisa mengganti password akun tersebut. Hanya cocok untuk aplikasi privat/personal — jangan dipakai di deployment publik.

User yang sudah login tetap bisa mengganti password sendiri di **Settings → Keamanan akun**; jalur ini memakai sesi Supabase biasa (tanpa service role key, tanpa email).

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
| `npm run db:seed` | Upsert katalog kartu + akun default + config untuk `SEED_USER_EMAIL` |
| `npm run db:seed:demo` | Seed + isi koleksi contoh |
| `npm run db:migrate:local` | Salin data PGlite lokal ke user Supabase (`SEED_USER_EMAIL`) |
| `npm run icons:build` | Regenerasi ikon PWA di `public/icons/` (butuh `sharp`) |

## Export, backup & impor

Semua ada di halaman **Data & Backup** (`/data`). File dibuat di server dari ledger saat ini, jadi selalu ikut data terbaru.

| Endpoint | Isi |
| --- | --- |
| `GET /api/export/json` | Backup lengkap: akun (termasuk stamina/Shinedust), semua holdings, seluruh riwayat transfer, dan aturan. |
| `GET /api/export/collection` | CSV `card_id,set_code,number,name,rarity,account,qty,target_qty` — satu baris per kartu per akun, bisa diimpor kembali apa adanya. |
| `GET /api/export/transfers` | CSV riwayat transfer lengkap dengan status dan tanggal. |

Ketiganya wajib sesi login dan mengirim `Content-Disposition: attachment`. **File berisi friend code dan catatan pribadi — jangan dibagikan.**

Impor koleksi menerima tempelan teks atau file `.csv`:

```
card,account,qty,target
A1-1,Akun 1: Main,2,1
PROMO-A-3,2,1
```

- Kolom: kartu, akun, qty, target (opsional). Header opsional; pemisah koma, titik koma, atau tab dideteksi otomatis.
- Kartu bisa berupa id (`A1-1`), `set-number` (`A1-001`), atau nama kartu yang unik. Akun bisa nama lengkap, nama pendek, atau `#1`–`#8`.
- Mode **Ganti jumlah** (default) menimpa nilai; mode **Tambah** menjumlahkan dengan qty yang ada (maks 99).
- **Pratinjau** menampilkan jumlah baris baru/berubah/tetap dan daftar baris bermasalah. Impor hanya menulis bila tidak ada baris bermasalah (maks 5.000 baris unik per batch).
- Baris untuk pasangan akun+kartu yang sama digabung otomatis; urutan baris terakhir menang pada mode ganti.

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
  (app)/data/             export & impor koleksi
  (app)/settings/         akun + aturan
  login/                  halaman login
  register/               halaman pendaftaran
  auth/callback/          tukar kode konfirmasi Supabase jadi sesi
  manifest.ts             manifest PWA
  api/export/[kind]/      unduhan JSON/CSV (butuh sesi)
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
  csv.ts                  escape/parse CSV (pure)
  export.ts               builder backup JSON + CSV (pure)
  import.ts               parser & resolver impor koleksi (pure)
  cards.ts                rarity/kind/target helpers
  game-day.ts             perhitungan hari reset + zona waktu
  settings.ts             default & parsing konfigurasi
  queries.ts              query baca (ledger, inventory) — selalu difilter user_id
  auth.ts                 user aktif + guard sesi (Supabase Auth)
  supabase/server.ts      Supabase server client (cookie SSR)
  i18n/                   kamus EN/ID + helper server & tipe
drizzle/                  migrasi SQL hasil drizzle-kit
data/catalog.json         katalog kartu (seed)
scripts/                  build-catalog, seed, migrate-local
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
