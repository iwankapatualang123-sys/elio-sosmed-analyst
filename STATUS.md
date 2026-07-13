# Status Pembangunan vs Blueprint

Peta item `Catatan_Update_Blueprint.md` → status. ✅ selesai · 🟡 sebagian · ⬜ belum.
Terakhir diperbarui: 2026-07-11.

## ✅ Sudah dibangun & terverifikasi

**Inti data & backend**
- Parser/sync/metrics/upload TikTok (§2,§3,§5,§16,§19) — 174 tes; tervalidasi export asli & tulis DB nyata.
- Database Supabase + RLS `can_access_account`, trigger profil, audit log, goals, anotasi (§13,§21A,§21B).
- Auth email/password + 3 role, proteksi rute, ganti password + tombol mata, idle auto-logout (§13,§21F).

**Halaman & fitur**
- **Toggle platform ringkasan atas** (Dashboard): KPI portofolio + Ranking Cabang bisa dipilih **TikTok / Instagram** (`PortfolioSummary` client, kedua dataset dirender server via `loadPortfolio` + `loadPortfolioInstagram`, ganti instan). IG: "Tayangan konten" (exclude kolaborasi), ER akun, Follower Δ dari new_followers harian, status naik/turun by pertambahan bersih; cabang tanpa data IG diredupkan + banner ajakan upload. TANPA opsi "Gabungan" (views TT video vs IG termasuk Story tidak setara). Filter kategori tetap via URL.
- Dashboard (§4): KPI, ranking + filter kategori, grafik, heatmap jam×hari, pemilih cabang, hashtag cloud (§21A), forecasting follower (§21A), peringatan/alert (§21C), target & progress (§21A), catatan/anotasi (§21A), insight 4-aspek + AI Groq (§5,§18). **Filter Bulan** (evaluasi kinerja tim per bulan, §21A): KPI/ranking/grafik/insight AI di-scope ke 1 bulan; Target&Progress dan Peringatan SENGAJA tetap sepanjang masa; follower dihitung pertumbuhan DALAM bulan itu; gender/lokasi pakai snapshot terakhir "pada/sebelum" bulan itu (tidak bocor data masa depan); proyeksi 7 hari disembunyikan saat meninjau bulan lampau. Laporan PDF & Excel (per-cabang & semua-cabang) ikut dapat filter bulan yang sama.
- Data (§20): tabel per aspek + filter bulan + search/sort/pagination + tren mingguan dalam bulan (§21A, diverging bar untuk follower yang bisa turun; minggu tanpa data tetap tampil 0, tidak hilang; label penjelas beda metrik views chart vs tabel; angka minus diwarnai merah). Tabel Konten terpisah otomatis saat 1 bulan dipilih: "Konten {bulan}" vs "📌 Konten Bulan Lain yang Masih Tinggi Performanya" (views > rata-rata akun) — supaya video lama yang masih ramai tidak tercampur diam-diam.
- Kalender konten (§21A). Global search (§21E). Upload (§19) dgn step-progress (§22).
- **Rencana Konten / Content Plan** (`/content-plan`) — kalender editorial per cabang meniru Excel "Content Plan": Post, PIC, Headline/Hook, Topic/Redaksi, Goals, Primary+Secondary Pillar, Type, Reference, ACC checkbox, **dropdown Cabang saat tambah rencana**. **Verifikasi status via link**: tim menempel `posted_url` (link konten tayang) di kolom "Link tayang" → dicocokkan dgn `video_id`/`video_link` data report TikTok Studio → **Verified / Not verified** (lib/tiktok/content-plan, 16 tes). Hook-match hanya jadi *hint* non-otoritatif. Ringkasan "Rencana Konten Bulan Ini" tampil di Dashboard. CRUD via modal + RLS. Filter cabang menyertakan cabang **diarsipkan** (berlabel, + banner) supaya rencana tak hilang saat cabang dinonaktifkan. Data 42 rencana (Juni 20 + Juli 22 2026) ada di cabang **Elio Coffee House**.
- **Rencana Konten multi-platform** (TikTok/Instagram/Threads): 1 rencana bisa menarget beberapa platform (kolom `platforms` text[] + `platform_links` jsonb; data lama otomatis TikTok-saja). Link tayang per platform di tabel & modal; status per platform (chip TT/IG/TH) + status keseluruhan = capaian terbaik antar platform (Verified > Uploaded > On Going > Cancelled). TikTok tetap diverifikasi otomatis vs data report; IG/Threads berbasis link (Uploaded) karena belum ada sumber data report resmi — rencana berikutnya: input manual metrik IG/Threads, lalu (jangka panjang) Meta Graph API/Threads API.
- **Snapshot manual Instagram/Threads (Lapis 1 laporan non-TikTok)**: tabel `social_account_snapshots` (deret waktu per cabang+platform+tanggal, upsert utk koreksi; RLS pola content_plans). Form input di halaman **Upload** (followers wajib; reach 30 hari & kunjungan profil opsional; daftar "input terakhir per cabang"), kartu **Dashboard** per platform: followers terakhir + Δ vs snapshot sebelumnya + ⚠ basi >7 hari. Helper murni `lib/social/snapshots.js` (17 tes). Lapis 2 (metrik per konten IG, opsional) & integrasi laporan mingguan menyusul.
- **Upload data Instagram — Tahap A** (export Meta Business Suite): parser `lib/instagram/parser.js` utk 2 format — metrik harian akun (UTF-16, Tayangan/Jangkauan/Kunjungan Profil/Pengikut baru/Interaksi) & per konten (CSV header-based, kolom bervariasi antar akun, deskripsi multi-baris, tanggal MM/DD/YYYY, konten kolaborasi akun lain ditandai `is_collab` via modus ID Akun) — 26 tes + tervalidasi 10 file asli. Tabel `instagram_daily_metrics` (unique cabang+metrik+tanggal, overlap-safe) & `instagram_content` (upsert per cabang+post_id; angka "Sepanjang Masa" diperbarui saat re-upload; ada kolom `follows` = follower dari konten itu). Kartu upload multi-file di halaman Upload (jenis file terdeteksi otomatis, hasil per file). **Detail Instagram (Dashboard)** ✅: bagian "Detail Instagram" sejajar "Detail TikTok" (heading platform), gated `hasIgData` — tren harian (Tayangan/Jangkauan/Kunjungan profil, LineChart per metrik), Performa per Jenis Konten (Reel/Gambar/Carousel: jml/tayangan/ER/+follower), Hashtag IG (dari caption), Top 5 Konten by tayangan, Pendatang Follower Terbanyak (top by follows). Helper `contentTypeBreakdown`/`hashtagStats`/`postTypeShort` di lib/instagram/metrics (26 tes).
**Tahap B (Dashboard)** ✅: panel 📸 Instagram di Dashboard mengikuti filter bulan — KPI akun (tayangan/jangkauan/kunjungan profil/follower baru, dari data harian, label jumlah hari terekam + catatan "termasuk Story"), total follower dari snapshot manual sebagai jangkar, ringkasan konten + **ER akun**, tabel **Top 5 Reels** (views, ER per konten, +follower dari konten, link permalink). Agregasi murni di `lib/instagram/metrics.js` (18 tes). Kartu snapshot manual menyusut jadi Threads-saja bila IG sudah punya data upload. **Menyusul**: IG di laporan bulanan/mingguan (PDF/Excel); **Tahap C**: verifikasi Rencana Konten IG via permalink.
- Laporan per-akun (infografis PDF cetak) + Excel (§7,§8). Laporan Semua Cabang (PDF + Excel §9). **Halaman index `/report`** (menu Nav "Laporan") — daftar semua cabang yang bisa diakses user (RLS-aware, cabang diarsipkan tetap tampil berlabel) dengan tombol Lihat + Excel **Bulanan** & Excel **Mingguan** langsung per cabang, tanpa perlu lewat Dashboard dulu. **Laporan Mingguan**: bulan dipecah jadi Minggu 1-5 dgn **rentang tanggal tiap minggu** (1–7, 8–14, dst — bukan cuma "M1/M2"; `weekDateRange`/`monthDateRange` di lib/tiktok/weekly) — route `/api/report/weekly-excel` (2 sheet: Ringkasan + Overview Mingguan, ada kolom Tanggal; tanpa param bulan = otomatis bulan terbaru) + tabel Rincian Mingguan di halaman laporan (muncul saat 1 bulan dipilih, bisa dicetak PDF). Grafik mingguan di halaman Data juga pakai label tanggal. **Daftar Konten** per periode: tabel video yang tayang pada bulan terpilih (kolom Minggu) di halaman laporan + sheet "Daftar Konten" di Excel Mingguan + kolom Minggu di sheet Data Konten Excel Bulanan. **Laporan bulanan**: "Jam Terbaik" jadi **Hari + Jam terbaik** (mis. "Selasa 18:00", `metrics.heatmapPeak`). Data aktivitas per-jam (Jam Terbaik/Heatmap) SELALU pakai jendela 7 hari terakhir + label tanggalnya (bukan discope bulan — data TikTok cuma 7 hari), tampil pesan bila belum ada.
- Pengaturan admin: kelola cabang/user/role/akses, arsip cabang, **edit & hapus permanen cabang** (konfirmasi ketik nama, cascade semua data terkait), **kelola kategori Rencana Konten** (PIC/Goals/Pillar/Type — dropdown form otomatis ikut update), backup semua data (§21D,§21F).
- **Analisis Pertumbuhan** (Dashboard, saat filter 1 bulan & kenaikan follower < bulan sebelumnya): diagnosis otomatis SEBAB perlambatan — urutan vonis: ER turun ≥15% relatif → *kualitas* (warning); jumlah konten turun ≥20% → *produksi* (warning); bulan lalu ada konten viral ≥3× rata-rata → *normalisasi* (info); selain itu → *distribusi* (info). Kartu berisi kesimpulan + 3 kartu pemeriksaan (konten/ER/outlier). `lib/tiktok/diagnosis.js`, 12 tes.
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
