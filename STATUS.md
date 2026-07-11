# Status Pembangunan vs Blueprint

Peta item `Catatan_Update_Blueprint.md` → status. ✅ selesai · 🟡 sebagian · ⬜ belum.
Terakhir diperbarui: 2026-07-09.

## ✅ Sudah dibangun & terverifikasi

**Inti data & backend**
- Parser/sync/metrics/upload TikTok (§2,§3,§5,§16,§19) — 174 tes; tervalidasi export asli & tulis DB nyata.
- Database Supabase + RLS `can_access_account`, trigger profil, audit log, goals, anotasi (§13,§21A,§21B).
- Auth email/password + 3 role, proteksi rute, ganti password + tombol mata, idle auto-logout (§13,§21F).

**Halaman & fitur**
- Dashboard (§4): KPI, ranking + filter kategori, grafik, heatmap jam×hari, pemilih cabang, hashtag cloud (§21A), forecasting follower (§21A), peringatan/alert (§21C), target & progress (§21A), catatan/anotasi (§21A), insight 4-aspek + AI Groq (§5,§18). **Filter Bulan** (evaluasi kinerja tim per bulan, §21A): KPI/ranking/grafik/insight AI di-scope ke 1 bulan; Target&Progress dan Peringatan SENGAJA tetap sepanjang masa; follower dihitung pertumbuhan DALAM bulan itu; gender/lokasi pakai snapshot terakhir "pada/sebelum" bulan itu (tidak bocor data masa depan); proyeksi 7 hari disembunyikan saat meninjau bulan lampau. Laporan PDF & Excel (per-cabang & semua-cabang) ikut dapat filter bulan yang sama.
- Data (§20): tabel per aspek + filter bulan + search/sort/pagination + tren mingguan dalam bulan (§21A, diverging bar untuk follower yang bisa turun; minggu tanpa data tetap tampil 0, tidak hilang; label penjelas beda metrik views chart vs tabel; angka minus diwarnai merah). Tabel Konten terpisah otomatis saat 1 bulan dipilih: "Konten {bulan}" vs "📌 Konten Bulan Lain yang Masih Tinggi Performanya" (views > rata-rata akun) — supaya video lama yang masih ramai tidak tercampur diam-diam.
- Kalender konten (§21A). Global search (§21E). Upload (§19) dgn step-progress (§22).
- **Rencana Konten / Content Plan** (`/content-plan`) — kalender editorial per cabang meniru Excel "Content Plan": Post, PIC, Headline/Hook, Topic/Redaksi, Goals, Primary+Secondary Pillar, Type, Reference, ACC checkbox, **dropdown Cabang saat tambah rencana**. **Verifikasi status via link**: tim menempel `posted_url` (link konten tayang) di kolom "Link tayang" → dicocokkan dgn `video_id`/`video_link` data report TikTok Studio → **Verified / Not verified** (lib/tiktok/content-plan, 16 tes). Hook-match hanya jadi *hint* non-otoritatif. Ringkasan "Rencana Konten Bulan Ini" tampil di Dashboard. CRUD via modal + RLS. Filter cabang menyertakan cabang **diarsipkan** (berlabel, + banner) supaya rencana tak hilang saat cabang dinonaktifkan. Data 42 rencana (Juni 20 + Juli 22 2026) ada di cabang **Elio Coffee House**.
- Laporan per-akun (infografis PDF cetak) + Excel (§7,§8). Laporan Semua Cabang (PDF + Excel §9). **Halaman index `/report`** (menu Nav "Laporan") — daftar semua cabang yang bisa diakses user (RLS-aware, cabang diarsipkan tetap tampil berlabel) dengan tombol Lihat + Excel **Bulanan** & Excel **Mingguan** langsung per cabang, tanpa perlu lewat Dashboard dulu. **Laporan Mingguan**: bulan dipecah jadi Minggu 1-5 dgn **rentang tanggal tiap minggu** (1–7, 8–14, dst — bukan cuma "M1/M2"; `weekDateRange`/`monthDateRange` di lib/tiktok/weekly) — route `/api/report/weekly-excel` (2 sheet: Ringkasan + Overview Mingguan, ada kolom Tanggal; tanpa param bulan = otomatis bulan terbaru) + tabel Rincian Mingguan di halaman laporan (muncul saat 1 bulan dipilih, bisa dicetak PDF). Grafik mingguan di halaman Data juga pakai label tanggal. **Daftar Konten** per periode: tabel video yang tayang pada bulan terpilih (kolom Minggu) di halaman laporan + sheet "Daftar Konten" di Excel Mingguan + kolom Minggu di sheet Data Konten Excel Bulanan. **Laporan bulanan**: "Jam Terbaik" jadi **Hari + Jam terbaik** (mis. "Selasa 18:00", `metrics.heatmapPeak`). Data aktivitas per-jam (Jam Terbaik/Heatmap) SELALU pakai jendela 7 hari terakhir + label tanggalnya (bukan discope bulan — data TikTok cuma 7 hari), tampil pesan bila belum ada.
- Pengaturan admin: kelola cabang/user/role/akses, arsip cabang, **edit & hapus permanen cabang** (konfirmasi ketik nama, cascade semua data terkait), **kelola kategori Rencana Konten** (PIC/Goals/Pillar/Type — dropdown form otomatis ikut update), backup semua data (§21D,§21F).
- Log aktivitas/audit trail (§21B). Onboarding tips (§21D).
- **Deploy produksi ke Vercel** (§24) — live di https://elio-sosmed-analyst.vercel.app (env var Supabase/Groq terpasang, auto-deploy dari branch `main`).

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

- **Instagram** (§14) — perlu Meta Graph API + App Review.
- **2FA admin** (§21F) — Supabase MFA (perlu keputusan kebijakan).
- **Push notification PWA** (§21C) — perlu VAPID key + web-push.
- **Export terjadwal** (§21C) — perlu cron (Supabase scheduled / eksternal).
- **Groq Edge Function** produksi (§18) — deploy edge function + secret.
- ~~TikTok oEmbed thumbnail~~ ✅ (§25) — /api/tiktok-thumbnail (dikecilkan sharp 600KB→~13KB + cache CDN, komponen `Thumbnail` dgn fallback 🎬), thumbnail + klik ke TikTok di tabel Konten **dan** di tabel Daftar Konten laporan (kolom Preview).
- Ganti password admin · Leaked Password Protection (N/A Free) · lisensi Freepik (§25).
