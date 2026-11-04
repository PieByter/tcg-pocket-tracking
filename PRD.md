# PRD: TCG Pocket Multi-Account Card Tracker

**Status:** Draft v0.1
**Owner:** Pieter
**Platform:** Web (mobile-first), Next.js di Vercel
**Pengguna:** Satu orang (pemilik 8 akun Pokémon TCG Pocket)

---

## 1. Latar Belakang

Pemilik mengelola sekitar 8 akun Pokémon TCG Pocket. Setiap akun sebaiknya punya minimal 2 kartu ex (kombinasi 4◇, 2★, 3★, crown), dan punya kartu trainer 1◇ sampai 3◇ yang sering dipakai battle. Saat ini pelacakan dilakukan manual, sehingga sulit tahu:

- akun mana yang kekurangan ex,
- akun mana yang punya duplikat yang bisa diberikan,
- kartu mana yang sudah dikirim atau ditrade, dan antar akun apa.

Tidak ada API resmi dari game, jadi aplikasi bersifat **pencatat dan perencana** (ledger + planner), bukan integrasi langsung dengan game.

## 2. Tujuan

1. Mencatat kepemilikan kartu relevan (ex dan trainer 1◇ sampai 3◇) per akun, dengan gambar.
2. Menunjukkan akun yang defisit (misalnya ex kurang dari 2) dan akun yang punya surplus.
3. Menyarankan kartu yang bisa dipindahkan antar akun lewat **Share** atau **Trade**, mematuhi batas harian game.
4. Mencatat riwayat perpindahan, dan memperbarui kepemilikan otomatis saat transfer dikonfirmasi.

## 3. Bukan Tujuan (v1)

- Sinkronisasi otomatis dengan game atau pembacaan akun game (tidak ada API resmi; jangan menyimpan kredensial game).
- Melacak seluruh koleksi kartu (hanya ex dan trainer 1◇ sampai 3◇ yang relevan).
- Multi-user, akun publik, marketplace.
- Perhitungan nilai atau harga kartu.

## 4. Aturan Game yang Menjadi Dasar

> Aturan ini bersumber dari panduan komunitas dan pengumuman resmi per akhir 2025 dan **bisa berubah**. Semua parameter harus disimpan sebagai konfigurasi, bukan hardcode. Verifikasi di dalam game sebelum dipakai.

| Fitur | Aturan |
|---|---|
| **Share** (satu arah) | Hanya antar teman. Rarity 1◇ sampai 4◇. Kirim satu kartu per teman per hari. Penerima menerima satu kartu per hari. Tanpa token dan tanpa stamina. |
| **Trade** (tukar) | Hanya antar teman. Kartu harus berrarity sama. Rarity yang bisa ditrade: 1◇ sampai 4◇, 1★, 2★, shiny 1 dan 2. Butuh Trade Stamina dan Shinedust (biaya naik sesuai rarity). |
| **Tidak bisa dipindah** | 3★ dan crown tidak bisa di-share maupun di-trade. |
| **Batas trade harian** | Pemilik menyebut maksimal 5 trade per hari dengan cooldown 1 hari. **Belum diverifikasi.** Simpan sebagai konfigurasi per akun. |
| **Jam reset hari** | Belum diketahui. Simpan sebagai setelan. |

Konsekuensi untuk desain:

- Trade 4◇ lawan 4◇ tidak mengubah jumlah ex di kedua akun, karena 4◇ sudah ex. Pemindahan yang **menambah** jumlah ex adalah Share, atau Trade di mana kedua sisi memberi duplikat dan menerima kartu yang belum dimiliki.
- Penerimaan dibatasi 1 kartu per akun per hari, jadi defisit N kartu butuh minimal N hari lewat Share.
- Kartu 2★ hanya bisa dipindah lewat Trade.

## 5. Persona dan Skenario Utama

**Pemilik 8 akun.**

1. Melihat dashboard: akun mana yang ex-nya kurang dari 2.
2. Memilih akun penerima, lalu akun pemberi lewat dropdown. Sistem menampilkan kartu (dengan gambar) yang bisa diberikan.
3. Membuat rencana transfer (Share atau Trade), melakukannya di game, lalu menandainya terkirim dan terkonfirmasi di aplikasi.
4. Kepemilikan kedua akun otomatis diperbarui dan riwayat tersimpan.

## 6. Kebutuhan Fungsional

### 6.1 Katalog kartu
- F1. Katalog kartu yang di-seed dari sumber data komunitas: set, nomor, nama, rarity, jenis (`ex`, `trainer`, `other`), `shareable`, `tradable`, URL gambar.
- F2. Hanya jenis `ex` dan `trainer` 1◇ sampai 3◇ yang ditampilkan secara default.
- F3. Gambar diambil dari URL sumber (tidak disalin ke storage sendiri), dengan lazy loading dan thumbnail.

### 6.2 Akun dan kepemilikan
- F4. CRUD akun (nama, friend code opsional, `min_ex` default 2).
- F5. Grid kartu dengan gambar per akun, tombol +/- jumlah, filter per set, rarity, dan jenis.
- F6. `target_qty` per kartu per akun. Default: trainer 1◇ sampai 3◇ = 2, ex = 1.
- F7. Layar koreksi untuk mengubah jumlah langsung (karena game adalah sumber kebenaran).

### 6.3 Dashboard
- F8. Ringkasan per akun: jumlah ex berbeda, defisit terhadap `min_ex`, defisit trainer terhadap target.
- F9. Penanda akun yang memenuhi syarat dan akun yang perlu dibantu.

### 6.4 Pemilih transfer (UI utama)
- F10. Layout: **Akun penerima** | dropdown **Akun pemberi** | daftar kandidat kartu.
- F11. Kandidat = kartu milik pemberi yang (a) belum dimiliki penerima, (b) surplus di atas `target_qty`, atau ex tunggal selama pemberi tetap memenuhi `min_ex` setelah memberi.
- F12. Setiap kandidat punya badge **Share** (rarity ≤ 4◇) atau **Trade** (2★ dan shiny). Untuk Trade, UI menyarankan kartu pengganti dengan rarity sama dari penerima.
- F13. Menampilkan sisa kuota hari ini (terima 0/1, kirim ke akun ini 0/1, stamina trade).

### 6.5 Transfer dan riwayat
- F14. Status transfer: `planned` → `sent` → `confirmed`, atau `cancelled`.
- F15. Saat `confirmed`, kepemilikan kedua akun diperbarui dalam **satu transaksi** database. Aksi ganda tidak boleh memindahkan dua kali (idempoten).
- F16. Batas harian ditegakkan di server: maksimal 1 penerimaan per akun per hari, 1 kiriman per pasangan akun per hari (untuk Share), dan batas trade per hari.
- F17. Riwayat transfer tidak dihapus. Koreksi dibuat sebagai transfer baru.

### 6.6 Planner (v1.1)
- F18. Menghasilkan jadwal harian untuk menutup semua defisit, dengan alokasi greedy yang menghormati batas harian.
- F19. Urutan prioritas: defisit ex terbesar dulu, lalu trainer. Saran Trade hanya jika Share tidak cukup (misalnya kartu 2★).

## 7. Model Data (ringkas)

```sql
card(id, set_code, number, name, rarity_rank, kind, shareable, tradable, image_url)
account(id, name, friend_code, min_ex int default 2)
holding(account_id, card_id, qty check (qty >= 0), target_qty default 0,
        primary key (account_id, card_id))
transfer(id, method, from_acct, to_acct, card_out, card_in, status, game_day, created_at)
app_config(key, value)  -- batas harian, stamina, jam reset, biaya Shinedust per rarity
```

Constraint penting: `qty >= 0`, `from_acct <> to_acct`, validasi `shareable`/`tradable` dan rarity sama untuk Trade (di service dan idealnya di DB), batas penerimaan harian dicek dalam transaksi.

## 8. Arsitektur dan Teknologi

- **Frontend dan backend:** Next.js (App Router) di Vercel. Server Actions untuk mutasi.
- **Database:** Postgres dengan connection pooler (mode transaksi), misalnya Neon atau Supabase. ORM: Drizzle atau Prisma.
- **Autentikasi:** login sederhana (password via env + cookie, atau Auth.js) agar data tidak terbuka di URL publik.
- **Planner dan kandidat:** fungsi murni di TypeScript, dites unit.
- **Gambar:** `next/image` dengan `remotePatterns`, atau `unoptimized` untuk daftar besar agar tidak menghabiskan kuota optimasi gambar.

## 9. Kebutuhan Non-Fungsional

- Mobile-first, bisa dipakai berdampingan dengan game.
- Daftar kartu dengan gambar tetap responsif (virtualisasi atau pagination jika perlu).
- Seluruh perubahan kepemilikan atomik dan dapat diaudit lewat riwayat transfer.
- Data kartu dapat diperbarui saat set baru rilis tanpa mengubah kepemilikan yang ada.

## 10. Risiko dan Mitigasi

| Risiko | Mitigasi |
|---|---|
| Aturan game berubah | Semua batas dan biaya disimpan sebagai konfigurasi, verifikasi berkala. |
| Data tracker menyimpang dari game | Status dua tahap + layar koreksi jumlah per akun. |
| Entri manual melelahkan | Batasi lingkup ke ex dan trainer 1◇ sampai 3◇, UI +/- cepat berbasis gambar. |
| Sumber data kartu tidak lengkap atau berubah | Seed dari sumber komunitas, izinkan tambah atau edit kartu manual. |
| Hak cipta gambar kartu | Hanya pemakaian pribadi, gunakan URL sumber, jangan dipublikasikan. |
| Transfer antar akun milik sendiri berpotensi melanggar ketentuan | Baca ToS dan syarat penggunaan sebelum dipakai dalam skala besar. |
| Kuota Vercel dan gambar | Thumbnail dari sumber, cek batas paket. |

## 11. Milestone

1. **M1 — Fondasi:** skema DB, seed katalog kartu, CRUD akun, login.
2. **M2 — Kepemilikan:** grid kartu dengan gambar, +/- jumlah, `target_qty`, layar koreksi.
3. **M3 — Dashboard dan kandidat:** ringkasan defisit, pemilih transfer (penerima, dropdown pemberi, daftar kandidat).
4. **M4 — Transfer dan riwayat:** status transfer, konfirmasi atomik, batas harian.
5. **M5 — Planner:** jadwal harian otomatis.

## 12. Kriteria Keberhasilan

- Dari dashboard, pemilik bisa mengetahui dalam kurang dari 10 detik akun mana yang defisit dan siapa pemberi yang cocok.
- Setiap transfer terkonfirmasi memperbarui kepemilikan kedua akun tanpa selisih.
- Tidak ada transfer yang melanggar batas harian yang tersimpan di konfigurasi.

## 13. Pertanyaan Terbuka

1. Apakah `min_ex` dihitung dari ex **berbeda** atau total salinan? (Asumsi sementara: berbeda.)
2. Berapa batas trade harian dan aturan regenerasi stamina yang sebenarnya?
3. Pukul berapa reset hari untuk batas Share dan Trade?
4. Sumber data katalog mana yang dipakai (cakupan set terbaru, lisensi, kualitas URL gambar)?
5. Apakah kartu non-ex 4◇ ke atas (misalnya trainer full art) perlu ikut dilacak?
