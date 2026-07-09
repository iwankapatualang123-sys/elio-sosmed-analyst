# Status Pembangunan vs Blueprint

Peta item `Catatan_Update_Blueprint.md` → status. ✅ selesai · 🟡 sebagian · ⬜ belum.
Terakhir diperbarui: 2026-07-09.

## ✅ Sudah dibangun & terverifikasi

**Inti data & backend**
- Parser/sync/metrics/upload TikTok (§2,§3,§5,§16,§19) — 174 tes; tervalidasi export asli & tulis DB nyata.
- Database Supabase + RLS `can_access_account`, trigger profil, audit log, goals, anotasi (§13,§21A,§21B).
- Auth email/password + 3 role, proteksi rute, ganti password + tombol mata, idle auto-logout (§13,§21F).

**Halaman & fitur**
- Dashboard (§4): KPI, ranking + filter kategori, grafik, heatmap jam×hari, pemilih cabang, hashtag cloud (§21A), forecasting follower (§21A), peringatan/alert (§21C), target & progress (§21A), catatan/anotasi (§21A), insight 4-aspek + AI Groq (§5,§18).
- Data (§20): tabel per aspek + filter bulan + search/sort/pagination + tren mingguan dalam bulan (§21A, diverging bar untuk follower yang bisa turun).
- Kalender konten (§21A). Global search (§21E). Upload (§19) dgn step-progress (§22).
- Laporan per-akun (infografis PDF cetak) + Excel (§7,§8). Laporan Semua Cabang (PDF + Excel §9).
- Pengaturan admin: kelola cabang/user/role/akses, arsip cabang, backup semua data (§21D,§21F).
- Log aktivitas/audit trail (§21B). Onboarding tips (§21D).

**Tampilan & PWA**
- Tema teal 3D + Poppins + ikon Lucide (§11,§23). PWA installable + offline + safe-area (§11).
- Skeleton/shimmer loading (§22), reduce-motion, upload step indicator (§22).

## 🟡 Sebagian

- Navigasi (§11): top-nav responsif; blueprint minta sidebar desktop + bottom-nav mobile.
- Tabel standar (§20): search/sort/pagination ✅; belum column-visibility, download per tabel, clickable row.
- AI Groq (§18): via Next API route; produksi idealnya Supabase Edge Function.
- Status Naik/Stabil/Turun (§25): default ±5%, ambang resmi belum dikonfirmasi.
- Manajemen periode lengkap/parsial (§21B): `is_incomplete` ditandai di tabel; belum ada ringkasan periode.

## ⬜ Belum — butuh usaha besar / sesi fokus

- **Dark mode** (§21E) — perlu refactor warna menyeluruh (banyak warna inline).
- **Multi-bahasa** (§21E) — i18n semua teks.
- **Migrasi `tiktok_accounts`→`social_accounts`** generik (§14) — menyentuh banyak query, risiko tinggi.
- Komentar internal · assignment tugas · approval workflow (§21B) — kolaborasi tim.
- Bulk action · template laporan custom (§21D).

## 🔒 Belum — butuh Anda / infrastruktur eksternal

- **Deploy ke Vercel** (§24) — akun Anda (panduan di README).
- **Instagram** (§14) — perlu Meta Graph API + App Review.
- **2FA admin** (§21F) — Supabase MFA (perlu keputusan kebijakan).
- **Push notification PWA** (§21C) — perlu VAPID key + web-push.
- **Export terjadwal** (§21C) — perlu cron (Supabase scheduled / eksternal).
- **Groq Edge Function** produksi (§18) — deploy edge function + secret.
- **TikTok oEmbed thumbnail** (§25) — validasi endpoint aktif.
- Ganti password admin · Leaked Password Protection (N/A Free) · lisensi Freepik (§25).
