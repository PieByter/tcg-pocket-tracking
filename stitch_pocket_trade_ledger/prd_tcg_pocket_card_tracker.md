# PRD: TCG Pocket Multi-Account Card Tracker
**Status:** Draft v0.1 | **Owner:** Pieter | **Platform:** Web (mobile-first / responsive desktop), Next.js di Vercel | **Pengguna:** Pemilik 8 akun Pokémon TCG Pocket

## 1. Ringkasan Eksekutif
Aplikasi pelacak koleksi kartu dan perencana perpindahan (ledger + planner) mandiri untuk 8 akun Pokémon TCG Pocket pribadi.
Fokus utama:
- Memastikan tiap akun memiliki minimal 2 kartu `ex` unik (4◇, 2★, 3★, Crown) dan kartu Trainer esensial (1◇ - 3◇).
- Menemukan surplus dan defisit kartu secara otomatis.
- Menyarankan opsi perpindahan kartu via Share (1 arah, 1 kartu/hari, ≤4◇) atau Trade (tukar sepadan rarity, kuota stamina).
- Eksekusi alur transfer: Planned -> Sent -> Confirmed (atomic balance update) & Daily Transfer Planner.