# Catatan Update Blueprint — Aplikasi Analitik TikTok Multi-Cabang (Elio Agency)

Dokumen ini adalah lanjutan/revisi dari `Blueprint_Flowwork_Roadmap_Aplikasi.md` awal, berdasarkan diskusi lanjutan dan validasi data nyata dari TikTok Studio.

---

## 1. Konteks & Perubahan Arah dari Blueprint Awal

- Aplikasi ini untuk **kebutuhan internal agency sendiri** (bukan produk SaaS yang dijual ke klien eksternal) — sistem multi-tenant, whitelabel domain, dan billing di blueprint awal **tidak relevan** untuk versi ini.
- Agency memegang **beberapa brand/akun TikTok sekaligus** — kebutuhan utama: agregasi & perbandingan lintas akun.
- Fase awal: **upload manual file export dari TikTok Studio** (bukan integrasi API otomatis). Auto-parser & integrasi API jadi fase lanjutan.
- Retention curve per detik (fitur "Content Doctor" di blueprint awal) dan Traffic Source (For You/Search/Following) **tidak tersedia** di file export manapun yang sudah diuji — butuh TikTok Business API approval atau third-party provider di fase lanjutan.

---

## 2. Sumber Data Terkonfirmasi (dari TikTok Studio Export)

| File | Isi | Granularitas |
|---|---|---|
| `Content.xlsx` | Judul, link, tanggal post, likes, comments, shares, views per video | Per video |
| `Overview.xlsx` | Video views, profile views, likes, comments, shares | Harian |
| `FollowerHistory.xlsx` | Jumlah follower + selisih harian | Harian |
| `FollowerGender.xlsx` | Distribusi gender follower | Snapshot |
| `FollowerTopTerritories.xlsx` | Distribusi lokasi follower | Snapshot |
| `FollowerActivity.xlsx` | Jumlah follower aktif per jam | Per jam, harian |
| `Viewers.xlsx` | Total/New/Returning viewers | Harian |

**Catatan format:**
- Tanggal pakai format lokal Indonesia tanpa tahun (misal "8 Juli") — parser harus infer tahun dan mapping nama bulan.
- Video ID harus di-extract dari URL video (tidak ada kolom ID terpisah) — dipakai sebagai primary key untuk deduplikasi.
- Ditemukan anomali data dari TikTok sendiri: nilai negatif (misal comments -1) dan nilai "undefined" pada hari yang belum lengkap — parser harus validasi/flag, bukan crash.

---

## 3. Fitur Dashboard & Analisis (Disepakati)

### Fase Awal (feasible dari data internal)
- Total konten per bulan
- Ranking top/bottom video (views, likes, engagement rate)
- Analisis hashtag berkorelasi performa
- Tren views/profile views/follower growth
- Demografi audiens (gender, lokasi) — dari FollowerGender & FollowerTopTerritories
- Jam terbaik posting — dari FollowerActivity
- Rasio new vs returning viewers — dari Viewers.xlsx
- Benchmark & ranking lintas-akun/brand
- Deteksi akun/brand stagnan
- Evaluasi "kenapa konten tidak viral" — komparasi internal (hashtag, jam post, hook vs engagement)
- Rekomendasi konten & jadwal — berbasis histori performa sendiri (bukan trend-aware)
- Data quality flagging (anomali)

### Fase Lanjutan (butuh validasi sumber data eksternal)
- Rekomendasi konten viral trend-aware (sound/hashtag yang sedang naik di luar akun) — butuh TikTok Creative Center / third-party trend data (Exolyt dkk)
- Retention curve per detik (Content Doctor)
- Traffic source (For You/Search/Following)

---

## 4. Struktur Halaman Dashboard (Web App)

- Kartu ringkasan: total akun aktif, total konten bulan ini, total views gabungan, rata-rata engagement rate
- Grafik perbandingan views antar akun (bar chart, filter periode)
- Tabel ranking performa akun: konten/bulan, views, engagement rate, follower Δ, status (naik/stabil/turun)
- Distribusi audiens gabungan (gender, top lokasi)
- Rencana lanjutan: halaman detail per-akun, filter kategori brand/industri

---

## 5. Template Laporan Excel (Sudah Dibangun — `Template_Laporan_Cabang.xlsx`)

Struktur sheet:
- `Data_Konten`, `Data_Follower`, `Data_Viewers` — tempat paste data mentah per cabang
- `Report` — laporan terformat, seluruh angka berbasis formula (bukan hardcode), auto-update saat data/periode diganti

Isi sheet Report:
1. Kartu ringkasan (views, konten, likes, comments, shares, engagement rate)
2. Grafik: bar top 5 konten, pie distribusi engagement, line tren views, bar benchmark periode
3. Grafik audiens: line follower growth, pie gender, bar horizontal top lokasi, stacked bar new vs returning viewers
4. Tabel benchmark periode ini vs sebelumnya (durasi sama)
5. **Kesimpulan, Saran & Kritik per Aspek** — insight otomatis (formula) + kolom manual untuk tim isi evaluasi tiap minggu/bulan, mencakup 4 aspek: Konten & Performa Views, Engagement Rate, Follower & Audiens, Retensi Viewers

**Cara multi-cabang:** duplikasi pasangan tab `Data_Konten` + `Report` per brand (belum otomatis, manual copy tab).

**Belum dikerjakan:** log historis evaluasi mingguan/bulanan (saat ini catatan Saran/Kritik ter-overwrite tiap ganti periode, belum tersimpan sebagai riwayat).

---

## 6. Ketentuan Desain Laporan Download (BARU)

Ada **2 tema/desain berbeda** tergantung level laporan:

### A. Laporan Per Akun/Cabang
- **Desain: infografis one-pager**, mengikuti referensi visual yang diberikan user (contoh: "One Page Facebook Social Media Status Report")
- Ciri-ciri desain referensi:
  - Header branded dengan ilustrasi/ikon platform
  - Kartu angka besar dengan indikator gain/loss (mis. "24,500 Number of Fans — Gained: 703, Lost: 42")
  - Kombinasi berbagai jenis grafik dalam satu halaman: area chart (tren harian), bar chart (engagement per tipe konten), pie/donut chart (impressions by age group, device usage), bar+line combo (reach & frequency)
  - Bagian "Key Takeaways" — ringkasan poin-poin naratif di akhir halaman
  - Palet warna korporat (biru dominan), layout padat tapi terstruktur dalam grid, satu halaman penuh
- **Tujuan:** laporan ringkas, visual, mudah dibaca cepat oleh 1 klien/brand — cocok dikirim langsung sebagai laporan mingguan/bulanan per akun

### B. Laporan Semua Cabang (Multi-Akun/Portfolio)
- **Desain: berbeda dari per-akun** — lebih ke arah tabel perbandingan & dashboard korporat, bukan infografis satu halaman
- Fokus: ranking antar akun, tabel benchmark, grafik komparasi (bukan storytelling 1 brand)
- Detail desain final masih perlu dirancang terpisah (belum di-lock)

**Perlu diingat:** kedua desain ini levelnya BEDA tujuan — per-akun untuk storytelling ringkas 1 brand, semua-cabang untuk keperluan internal agency membandingkan performa portfolio.

---

## 7. Ketentuan Format Export (BARU)

Setiap jenis laporan (per akun maupun semua cabang) ke depannya harus bisa di-download dalam **2 tipe file**:

| Tipe | Kegunaan |
|---|---|
| **Excel (.xlsx)** | Data mentah + formula, bisa diedit/dianalisis lebih lanjut, cocok untuk kerja internal tim |
| **PDF** | Versi cetak/kirim final, tidak bisa diedit, cocok dikirim ke klien atau untuk arsip laporan |

Implikasi teknis: sistem butuh 2 jalur render berbeda dari satu sumber data —
- Excel: seperti yang sudah dibangun (openpyxl, formula-based)
- PDF: kemungkinan butuh layout terpisah/khusus (HTML-to-PDF atau desain infografis custom), terutama untuk laporan per-akun yang bergaya infografis — PDF infografis TIDAK bisa sekadar "export as PDF" dari file Excel karena beda filosofi layout (Excel = data grid, infografis = desain bebas/visual).

---

## 8. Prototipe PDF Infografis Per Akun — SUDAH DIBANGUN

File: `Laporan_Per_Akun_Infografis.pdf` (contoh/prototipe dengan data dummy Elio Coffee House)

**Tool/teknik yang dipakai:**
- Chart individual di-generate pakai `matplotlib` (area chart, bar chart, pie/donut, combo bar+line, diverging bar) → disimpan sebagai PNG transparan
- Layout halaman disusun pakai HTML + CSS (grid section, kartu metrik, warna korporat biru/teal)
- Render HTML → PDF pakai `wkhtmltopdf` (tersedia di environment, tidak perlu install tambahan)
- Hasil: 1 halaman A4, siap download/kirim ke klien

**Pemetaan bagian dari referensi (Facebook Status Report) ke versi TikTok:**

| Bagian di Referensi | Diganti Jadi (TikTok) | Sumber Data |
|---|---|---|
| Number of Fans (gain/loss) | Total Views + growth % vs periode lalu | Data_Konten |
| Avg Engagement Rate | Avg Engagement Rate | Data_Konten |
| Avg Click-Through Rate | Avg Views / Post | Data_Konten |
| Page Like Share by Gender | Distribusi Follower by Gender & Usia | FollowerGender.xlsx (usia: belum tersedia dari TikTok, saat ini estimasi/placeholder) |
| Day Wise Impressions Per Post | Tren Views Harian | Overview.xlsx |
| Avg Engagement Per Post (by Link/Photo/Video) | Avg Likes/Comments/Shares Per Post | Data_Konten (TikTok cuma punya 1 tipe post: video, jadi breakdown by tipe konten tidak relevan) |
| Page Impressions by Age Group | Top Lokasi Follower (pie) | FollowerTopTerritories.xlsx — pengganti age group karena data usia tidak tersedia dari export TikTok |
| FB Ad Impressions with Reach & Frequency | Views & Pertumbuhan Follower Mingguan (combo chart) | Overview.xlsx + FollowerHistory.xlsx |
| Customer Device Usage | Retensi Viewers (New vs Returning, donut) | Viewers.xlsx — pengganti device usage karena data device tidak tersedia dari export TikTok |
| Key Takeaways | Key Takeaways | Auto-ringkas dari insight yang sudah dibangun di sheet Excel |

**Catatan simplifikasi:**
- Ilustrasi laptop/megaphone di header referensi disederhanakan jadi logo lingkaran bertuliskan "TT" — karena tidak ada akses aset gambar/internet di environment build. Kalau agency punya logo sendiri, bisa disisipkan menggantikan ini.
- Data usia follower (age group) di gender chart masih **placeholder/estimasi**, bukan data asli — TikTok export yang sudah divalidasi cuma kasih gender & lokasi, bukan breakdown usia. Perlu ditandai jelas di versi produksi supaya tidak menyesatkan, atau dihapus kalau tidak ada sumber data valid.

**Yang belum dikerjakan dari desain ini:**
- [ ] Otomatisasi: PDF ini masih dibuat manual per generate, belum terhubung ke data live dari `Template_Laporan_Cabang.xlsx`
- [ ] Versi dengan logo/branding asli agency (bukan placeholder "TT")
- [ ] Konfirmasi ke user: apakah data usia follower dihapus dari desain final (karena tidak ada sumbernya) atau tetap sebagai estimasi dengan disclaimer

---

## 9. Prototipe PDF Laporan Semua Cabang — SUDAH DIBANGUN

File: `Laporan_Semua_Cabang.pdf` (contoh/prototipe dengan data dummy 6 cabang)

**Desain ini mengambil referensi yang SAMA dengan template Excel** ("Social Media Analytics Report Template" — header navy, kartu total reach, tabel top posts, kotak hijau engagement, kotak abu-abu, tabel benchmark, tabel rinci hijau tua di bawah) — bukan gaya infografis seperti laporan per-akun.

**Perbedaan filosofi vs laporan per-akun (bagian 8):**

| Aspek | Per Akun (infografis) | Semua Cabang (tabular) |
|---|---|---|
| Tujuan | Storytelling ringkas 1 brand, dikirim ke klien | Kerja internal agency, bandingkan performa portofolio |
| Gaya visual | Kartu besar + chart warna-warni, 1 halaman visual-heavy | Tabel padat, angka rinci, minim ilustrasi |
| Unit analisis | Konten/video dalam 1 akun | Cabang/akun sebagai baris data |

**Struktur halaman:**
1. Header + input periode (mulai/selesai) + jumlah cabang aktif
2. KPI portofolio (Total Views, Total Konten, Avg Engagement Rate, Net Follower Growth, Avg Views/Post) — total gabungan semua cabang
3. Ranking Cabang — Minggu Ini & Bulan Ini (dua tabel terpisah, mirror dari "Top Posts Last Week/Last Month" di referensi, tapi unitnya cabang bukan post)
4. Kotak hijau (Avg Engagement Rate Portofolio) & kotak abu-abu (Net Follower Growth Portofolio) — pengganti "Total Clicks" karena TikTok tidak punya data klik
5. Tabel benchmark 30 hari per cabang
6. Tabel rinci semua cabang (hijau tua) — lengkap dengan kolom Status (Naik/Stabil/Turun)

**Tool/teknik:** sama seperti laporan per-akun — HTML + CSS → `wkhtmltopdf`. Ditambah **section "Grafik Perbandingan Antar Cabang"** (2x2 grid, bar chart matplotlib): Total Views, Engagement Rate, Total Konten, Net Follower Growth — semua pakai bar chart karena tujuannya membandingkan magnitude antar cabang (bukan tren waktu/proporsi, jadi tidak perlu pie/line di level ini).

**Yang belum dikerjakan dari desain ini:**
- [ ] Hubungkan ke data live (masih data dummy 6 cabang)
- [ ] Definisikan ambang batas resmi untuk kolom Status (Naik/Stabil/Turun) — saat ini masih estimasi manual, belum formula baku
- [ ] Sinkronisasi dengan sheet "Ringkasan Semua Cabang" di Excel (poin di bagian 9 di bawah) — idealnya PDF ini generate dari sheet yang sama

---

## 11. Tema Visual Dashboard Web App — DISEPAKATI

Sumber referensi: konsep desain "crowdfunding app" dari Freepik (`crowdfunding-app-concept.zip`) — **hanya diambil palet warna, font, dan gaya visualnya**, bukan layout/komponennya (karena konten aslinya untuk app donasi, bukan dashboard analitik).

**⚠️ Catatan lisensi:** aset asal dari Freepik. Kalau didownload dengan akun free, wajib cantumkan atribusi "Designed by Freepik" di aplikasi. Kalau akun premium, tidak perlu atribusi tapi simpan bukti lisensi dari akun tersebut. Perlu dicek dulu akun mana yang dipakai sebelum rilis produksi.

**Palet warna (diambil langsung dari pixel referensi):**

| Warna | Hex | Peran |
|---|---|---|
| Teal gelap | `#006674` | Primary/header |
| Teal lebih gelap | `#00545E` | Aksen/hover |
| Hijau mid | `#4F9E7A` / `#7FBF8F` | Gradasi sekunder |
| Mint muda | `#DBEFD4` | Background |
| Sage muted | `#93BCAD` | Elemen non-aktif |
| Putih | `#FFFFFF` | Card/surface |

**Font:** Poppins (lisensi aman, dari Font Squirrel/Indian Type Foundry).

**Preferensi desain (dari sesi tanya-jawab):**
- Boleh beda gaya antara dashboard app dan laporan PDF (tidak harus konsisten satu identitas visual)
- Belum ada brand color/logo resmi Elio Agency — desain di atas jadi default sementara

**Gaya visual dashboard final:**
- Gradasi warna diagonal (teal gelap → teal → hijau muda), bukan flat
- Kartu **oval/pill-shaped** (border-radius besar, 26-50px), bukan kotak siku
- Elemen dekoratif: lingkaran putus-putus, segitiga transparan, titik-titik — tersebar di background mengikuti gaya referensi
- **Efek 3D/depth**: shadow berlapis (soft + tajam) di tiap kartu, inner highlight di tepi atas kartu untuk kesan glossy, gradasi halus putih→hijau muda di dalam kartu, bar chart dengan shadow supaya terasa timbul
- File referensi visual: `Mockup_Tema_Dashboard_Gradasi_3D.png`

**Perbedaan Desktop vs Device (PWA):**

| Aspek | Desktop/Browser | Device/PWA |
|---|---|---|
| Navigasi | Sidebar kiri, tetap terlihat | Bottom tab bar |
| Grid kartu metrik | 4 kolom | 2 kolom, ditumpuk |
| Tabel/ranking | Penuh, banyak kolom | Disederhanakan, mungkin perlu scroll |
| Grafik | Lebar, detail lebih banyak | Ringkas, fokus 1 chart per kartu |

**Ketentuan teknis PWA yang wajib masuk rencana build:**
- `manifest.json` — nama app, icon (192px & 512px), `theme_color: #006674`, `display: standalone`
- Safe area insets (`env(safe-area-inset-*)`) untuk device dengan notch
- Service worker + caching untuk akses offline/koneksi lemah (penting buat tim di cabang dengan internet tidak stabil)
- Breakpoint utama di ~768px untuk switch sidebar ↔ bottom-nav
- Touch target minimum 44x44px di versi mobile

**Yang belum dikerjakan dari tema ini:**
- [ ] Konversi mockup PNG jadi kode HTML/CSS/component yang bisa dipakai developer (saat ini masih gambar statis)
- [ ] Konfirmasi status lisensi Freepik (free vs premium) sebelum rilis produksi
- [ ] Terapkan tema ini ke seluruh halaman dashboard (baru diterapkan ke 1 contoh layout ringkasan)

---

## 13. Database Supabase — Auth, Cabang & Data TikTok — SUDAH DIBUAT

**Project:** `Digihub` (project_id: `msisofuggqoodlwjqxzw`), akun Supabase kedua milik user (bukan akun Cashier/HR yang lama).

**Tabel Auth & Cabang:**
- `profiles` — extend dari `auth.users` bawaan Supabase, kolom `role` (enum: admin/manager/staff), `is_active`, `created_by`
- `tiktok_accounts` — daftar cabang/akun TikTok: nama_cabang, tiktok_username (unik), kategori, logo_url, is_active
- `user_branch_access` — tabel penghubung many-to-many, 1 user bisa pegang beberapa cabang (sesuai keputusan user)

**Tabel Data TikTok (BARU):**

| Tabel | Sumber Data Asal |
|---|---|
| `tiktok_content` | Content.xlsx — per video |
| `tiktok_daily_overview` | Overview.xlsx — harian |
| `tiktok_follower_history` | FollowerHistory.xlsx |
| `tiktok_follower_gender` | FollowerGender.xlsx |
| `tiktok_follower_territories` | FollowerTopTerritories.xlsx |
| `tiktok_follower_activity` | FollowerActivity.xlsx |
| `tiktok_viewers` | Viewers.xlsx — ada kolom `is_incomplete` untuk tangani nilai "undefined" |

**Keputusan akses:**
- 3 level role: Admin (lihat semua cabang otomatis), Manager (beberapa cabang), Staff (cabang yang di-assign)
- Semua tabel data pakai RLS seragam lewat fungsi `can_access_account()`: SELECT sesuai akses cabang, INSERT/UPDATE khusus admin & manager, DELETE khusus admin
- Fitur "add akun tambahan" — didukung lewat kolom `created_by` di `profiles` untuk jejak audit siapa menambahkan siapa

**Keamanan:** Fungsi helper (`current_user_role`, `can_access_account`) sudah di-harden penuh — search_path di-set, akses `anon` di-revoke total (cuma `authenticated` yang boleh panggil). Sudah dicek lewat Supabase security advisor, bersih dari isu kritis untuk semua tabel yang kita buat. Ada 1 warning project-level (leaked password protection) yang perlu diaktifkan manual lewat dashboard Supabase, di luar cakupan tabel.

**Belum dibuat:** parser/sync code (`lib/tiktok/*.js`) untuk isi tabel-tabel ini dari file upload — itu tahap selanjutnya, mengikuti konvensi arsitektur di bagian 16.

---

## 14. Rencana Ekspansi: Instagram (dan Kemungkinan Platform Lain)

**Status:** Baru tahap diskusi/perencanaan, belum dieksekusi ke database.

**Keputusan:** Skema database akan dirancang **generik multi-platform** sejak awal (bukan tabel terpisah per platform) — karena ada kemungkinan nambah platform lain (YouTube, dst) di masa depan meski belum pasti.

**Perbedaan kunci Instagram vs TikTok yang mempengaruhi desain:**
- Instagram wajib pakai **Business/Creator account** (terhubung ke Facebook Page) untuk bisa akses Insights — beda dari TikTok yang bisa dari akun biasa
- Instagram **tidak punya export manual sebagus TikTok Studio** — lebih ke arah lihat di layar (app Instagram/Meta Business Suite), opsi export terbatas
- Jalur data terprogram: **Instagram Graph API** (Meta for Developers), butuh Facebook Developer App + App Review dari Meta — mirip proses approval TikTok Business API
- Instagram punya **3 jenis konten** dengan metrik berbeda-beda: Feed post (saves, reach), Reels (plays, mirip TikTok), Stories (exits, replies) — beda dari TikTok yang cuma 1 jenis konten (video)

**Konsep skema generik (rencana, belum dieksekusi):**

| Tabel | Rencana Perubahan |
|---|---|
| `tiktok_accounts` | Generalisasi jadi `social_accounts` + kolom `platform` (enum: tiktok, instagram, dst) |
| `content` (baru) | Generik: `platform`, `content_type` (video/feed/reels/stories), metrik umum sebagai kolom tetap (views, likes, comments, shares) + `extra_metrics` (JSONB) untuk metrik platform-spesifik (saves, replies, dll) |
| `daily_overview`, `followers_*`, `viewers_*` | Sama, disesuaikan pakai `social_account_id` generik |

**Yang perlu divalidasi ulang saat eksekusi teknis (kebijakan Meta sering berubah):**
- [ ] Cara paling praktis export data Instagram Insights saat ini
- [ ] Syarat & proses approval Instagram Graph API terbaru
- [ ] Nama field metrik terbaru di Graph API (saves, reach, dll)

---

## 16. Konvensi Arsitektur & Coding — DISEPAKATI

**Keputusan fokus:** Kerjakan **TikTok dulu sampai selesai/stabil**, Instagram menyusul kemudian (bukan dikerjakan paralel).

**Arsitektur kode — pemisahan per platform:**
- Function/file pemrosesan data **dipisah per sosial media**, tidak boleh tercampur dalam satu file.
- Contoh struktur folder yang akan dipakai:
  ```
  /lib
    /tiktok
      parser.js       -> parsing file export TikTok Studio (Content, Overview, Follower*, Viewers)
      metrics.js       -> perhitungan engagement rate, ranking, dll khusus TikTok
      sync.js           -> proses simpan ke Supabase khusus data TikTok
    /instagram
      parser.js         -> (nanti) parsing data Instagram, terpisah total dari tiktok/parser.js
      metrics.js
      sync.js
  ```
- Alasan: saat analisa TikTok jalan, kode yang dipakai murni dari folder `tiktok/` — tidak ada risiko logic Instagram ikut ke-load atau bikin bug silang platform. Memudahkan maintain & debug per platform secara independen.
- Catatan: ini agak beda arah dari keputusan skema **database** generik multi-platform (bagian 14) — jadi database-nya generik/gabungan, tapi kode pemroses (parser/function) tetap dipisah per platform. Dua hal ini tidak bertentangan: skema tabel yang generik tetap diisi lewat kode yang terpisah per sumber data.

**Konvensi komentar kode — WAJIB untuk semua kode ke depan:**
- Setiap file kode diawali komentar penjelasan isi/tujuan file.
- Setiap function diberi komentar di baris awal menjelaskan fungsinya (input, output, tujuan).
- Contoh format:
  ```javascript
  // File: lib/tiktok/parser.js
  // Tujuan: parsing file export TikTok Studio (Content.xlsx, Overview.xlsx, dll)
  // jadi format data siap simpan ke Supabase.

  // Fungsi: extractVideoId
  // Ambil ID video dari URL TikTok (contoh: .../video/7647134669963529479 -> "7647134669963529479")
  // Input: string URL video
  // Output: string video ID, atau null kalau format URL tidak dikenali
  function extractVideoId(url) { ... }
  ```

---

## 18. Rencana Integrasi AI (Groq) untuk Insight Otomatis

**Status:** Disepakati, belum dieksekusi (menunggu tabel data TikTok selesai dulu).

**Konsep:** Insight Kesimpulan/Saran/Kritik yang saat ini berbasis formula IF (templated) akan diperkaya jadi kalimat natural yang ditulis AI, berdasarkan angka yang sama (engagement rate, growth %, dst dihitung seperti biasa, lalu dikirim sebagai konteks ke Groq API untuk dirangkai jadi kalimat).

**Arsitektur (mengikuti konvensi pemisahan kode per platform di bagian 16):**
- `lib/ai/groq-client.js` — wrapper generik pemanggil Groq API, platform-agnostic (dipakai TikTok maupun Instagram nanti)
- `lib/tiktok/insight-prompt.js` — penyusun prompt khusus TikTok (istilah metrik beda dari platform lain)

**Ketentuan keamanan (WAJIB):**
- Groq API key **tidak boleh** ditaruh di kode frontend/PWA (bisa dicuri lewat DevTools browser)
- Wajib dipanggil lewat **Supabase Edge Function** — key disimpan sebagai secret di server, browser cuma panggil endpoint Supabase

**Pembagian tanggung jawab AI vs manusia:**
- Insight (kotak hijau, ringkasan otomatis) → boleh full AI-generated
- Saran & Kritik strategis → AI kasih draft awal, tim tetap review/edit manual sebelum jadi laporan final (tidak 100% lepas tangan ke AI untuk keputusan strategis)

**Yang perlu divalidasi saat implementasi:**
- [ ] Nama model Groq yang tersedia saat ini, rate limit, harga (perlu web search saat dikerjakan, karena info bisa berubah)

---

## 19. Spesifikasi Upload & Parsing File — DISEPAKATI

**Mendukung 3 cara upload:**
- Upload file **ZIP** (sesuai download asli TikTok Studio yang memang berbentuk zip)
- Upload file **.xlsx lepasan** (kalau user sudah extract sendiri)
- **Drag-and-drop** multi-file sekaligus (bisa beberapa zip/xlsx bersamaan) + tombol browse sebagai fallback (penting untuk versi mobile PWA)

**Penentuan cabang — kombinasi pilih manual + auto-deteksi:**
- User pilih cabang dari dropdown dulu (eksplisit)
- Sistem juga baca username dari nama file (contoh: `Content_elioagency.zip` → deteksi `elioagency`)
- Kalau username hasil deteksi TIDAK cocok dengan cabang yang dipilih → tampilkan **peringatan konfirmasi** ("File ini terdeteksi milik @elioagency, tapi Anda pilih cabang X. Lanjutkan?") — mencegah salah masuk data ke cabang keliru

**Format & deteksi jenis file:**
- Deteksi jenis data dari nama file di dalam zip: Content.xlsx, Overview.xlsx, FollowerHistory/Gender/TopTerritories/Activity.xlsx, Viewers.xlsx
- File tidak dikenal → skip + beri tahu user, bukan error/crash

**Deduplikasi — overwrite (upsert) + notifikasi:**
- Data dengan key sama ditimpa dengan data baru (video_id sama untuk content, date sama untuk overview/follower/viewers) — karena angka views/likes bisa naik seiring waktu, data terbaru lebih akurat
- Pakai `upsert` Supabase (skema sudah punya unique constraint yang sesuai)
- Setelah selesai, tampilkan ringkasan notifikasi: jumlah data baru ditambah, jumlah diperbarui, jumlah dilewati (misal karena "undefined"/tidak lengkap)

**Implementasi:** logika ini jadi isi `lib/tiktok/parser.js` + `lib/tiktok/sync.js` (mengikuti konvensi pemisahan per platform di bagian 16).

---

## 20. Komponen Tabel Standar (Reusable) — DISEPAKATI

**Prinsip:** SEMUA tabel di aplikasi pakai SATU komponen reusable yang sama, dengan SEMUA fitur di bawah aktif (bukan menyesuaikan per tabel). Tujuan: konsistensi penuh di semua halaman/aspek. Rekomendasi teknis: pakai TanStack Table (React) sebagai fondasi supaya fitur built-in dan tidak bikin manual dari nol.

**Fitur wajib di setiap tabel:**
- Search (kotak pencarian teks)
- Sorting (klik header kolom, naik/turun)
- Filter tanggal (date picker kalender)
- Filter kolom/kategori (filter cabang, status, dll — selain search teks)
- Navigasi maju-mundur (pagination dengan tombol panah)
- Pagination info ("menampilkan 1-20 dari 145") + pilihan baris per halaman (20/50/100)
- Download report (export Excel/PDF)
- Sticky header (header tetap terlihat saat scroll)
- Column visibility toggle (sembunyikan/tampilkan kolom)
- Clickable row (klik baris → detail, misal klik video → detail video)

**Kondisi khusus (state) yang wajib ditangani:**
- Empty state ("Belum ada data untuk periode ini")
- Loading state (skeleton/spinner saat ambil data dari Supabase)
- Error state (kalau gagal load)
- Data quality flag (ikon peringatan di baris dengan anomali — nilai undefined/negatif)

**Mobile/PWA:**
- Tabel di layar kecil pakai **horizontal scroll** (tetap bentuk tabel, geser kiri-kanan) — bukan diubah jadi card
- Tombol sorting/pagination cukup besar untuk touch (min 44x44px sesuai standar PWA di bagian 11)

---

## 21. Backlog Fitur Tambahan (Kategori A–F) — DISETUJUI MASUK PERENCANAAN

User memilih seluruh kategori A sampai F untuk masuk perencanaan.

### A. Data & Analitik
- Perbandingan periode fleksibel (bandingkan bulan/minggu bebas, bukan cuma vs periode lalu)
- Goals/target per cabang (set target views/engagement, tampilkan progress vs target)
- Anotasi data (catatan di tanggal tertentu: "ada promo", "kolaborasi influencer" — konteks untuk lonjakan/penurunan)
- Analisis hashtag mendalam (ranking hashtag by performa, hashtag cloud, tren pemakaian — data sudah ada di judul video)
- Best posting time heatmap (visual jam × hari terbaik dari FollowerActivity)
- Forecasting sederhana (proyeksi tren views/follower berbasis histori, regresi sederhana — bukan AI berat)
- Content calendar view (kalender visual kapan video di-post + performa per tanggal)

### B. Kolaborasi & Workflow Tim
- Log aktivitas / audit trail (siapa upload/edit/hapus apa, kapan — melengkapi kolom `created_by`)
- Komentar/diskusi internal (tim diskusi di dalam laporan, manager kasih catatan ke staff)
- Assignment tugas ("cabang X perlu evaluasi, tugaskan ke staff Y")
- Approval workflow (laporan di-review manager sebelum final/dikirim)
- Manajemen periode (flag periode lengkap vs parsial — nyambung dengan `is_incomplete`)

### C. Notifikasi & Otomatisasi
- Viral alert (notif video melonjak — dari blueprint awal)
- Anomaly alert (follower turun drastis, engagement anjlok, cabang stagnan)
- Reminder upload (ingatkan tim upload data mingguan kalau belum)
- Export terjadwal (laporan auto-generate & kirim tiap Senin/awal bulan)
- Push notification PWA (notif ke HP walau app ditutup)

### D. Manajemen & Pengaturan
- Onboarding/tutorial untuk user baru
- Bulk action (generate laporan/kelola banyak cabang sekaligus)
- Template laporan custom (user atur metrik yang muncul di laporan)
- Kategori/tag cabang (grup by industri/wilayah untuk perbandingan apple-to-apple — nyambung kolom `kategori` di `tiktok_accounts`)
- Arsip cabang (nonaktifkan cabang lama tanpa hapus data — sudah ada `is_active`)

### E. Pengalaman & Aksesibilitas
- Dark mode (perlu dirancang terpisah karena tema gradasi teal)
- Reduce motion (aksesibilitas animasi)
- Multi-bahasa (kalau perlu)
- Offline mode (lihat data terakhir tanpa internet — PWA + cache, penting untuk tim lapangan)
- Global search (cari cepat lintas cabang/video dari satu kotak)

### F. Keamanan & Keandalan
- Session timeout (auto-logout setelah idle — penting karena aplikasi tim dengan banyak akun login; cegah data terekspos kalau HP staff hilang/dipinjam)
- Backup/export database berkala (Supabase punya backup bawaan di paket berbayar; kalau paket free, perlu backup manual supaya data tidak hilang permanen)
- Rate limit upload (cegah spam upload yang bikin sistem lemot)
- 2FA untuk akun admin (keamanan ekstra untuk akun yang bisa akses semua cabang)
- Catatan: F menyangkut keamanan data klien & akun tim — bukan fitur "wah" tapi wajib dipertimbangkan sebelum rilis produksi dengan data beneran.

### Prioritas yang direkomendasikan masuk scope awal
Dari semua di atas, yang paling nyambung dengan yang sudah dibangun + minim usaha tambahan: Log aktivitas (B), Manajemen periode (B), Notifikasi/alert (C). Sisanya fase lanjutan.

---

## 22. Transisi Halaman & Loading State — DISEPAKATI

- Transisi antar halaman: fade + slide halus (modern tapi tidak berlebihan)
- Loading saat LOAD data: skeleton screen / shimmer (lebih modern dari spinner, tampilkan bentuk halaman dulu)
- Loading saat SIMPAN/upload data: progress bar + step indicator ("Ekstrak zip → Baca data → Simpan → Selesai") + success animation (centang hijau) + ringkasan notifikasi
- Wajib ringan (CSS transform/opacity, jangan bikin lag di HP menengah)
- Hormati setting "reduce motion" (aksesibilitas)
- Loading state wajib ada karena internet cabang bisa lambat — user harus selalu tahu sistem sedang bekerja

---

## 23. Komponen UI Style — DISEPAKATI (gaya 3D futuristik)

Referensi visual: `Mockup_Komponen_UI_3D.png`
- Icon per aspek: chip gradasi 3D warna berbeda per metrik (views=teal, engagement=hijau, follower=biru, konten=amber)
- Metric card: gradasi halus + shadow berlapis + inner highlight (kesan timbul)
- Button 3D: shadow bawah tebal (kesan tombol fisik punya ketebalan), gradasi atas-terang/bawah-gelap, highlight tepi atas. Varian: primary (teal), success (hijau), ghost (putih)
- Tabel 3D futuristik: header gradasi teal sudut membulat, baris terpisah dengan spacing + shadow per baris (kesan kartu mengambang), badge status dengan gradasi, toolbar dengan search box efek inset/cekung
- Setiap aspek WAJIB ada ikon (sesuai permintaan user)
- Catatan: di produksi pakai icon library beneran (Tabler/Lucide), bukan SVG manual

---

## 24. Rencana Deployment & Tahap Coding

**Alur deployment yang direkomendasikan (setelah aplikasi jadi):**
1. Push kode aplikasi ke GitHub
2. Hubungkan repo GitHub ke Vercel (sekali setup)
3. Setiap update di GitHub → Vercel auto-deploy otomatis
4. Environment variables (Supabase key, Groq key) diatur di dashboard Vercel — jangan hardcode di kode

**Catatan akses lokal (alternatif, kalau mau on-premise):**
- IP lokal `192.168.2.222:3006` hanya bisa diakses dari perangkat di jaringan/WiFi yang sama (kantor)
- Karena aplikasi ini PWA untuk tim di banyak cabang, Vercel (akses internet global) lebih cocok daripada IP lokal
- Kalau tetap mau lokal: butuh file BAT (Windows) yang jalankan `npm run dev` di port 3006 + Node.js terinstall + IP komputer server harus statis. BAT ini baru berguna setelah aplikasi dibangun.

**Tahap coding — pindah ke Claude Code:**
- Chat interface ini optimal untuk: perencanaan, desain, dokumen, setup database (via koneksi Supabase). Sudah maksimal dikerjakan di sini.
- Untuk coding aplikasi penuh + deploy: gunakan **Claude Code** (Claude jalan di terminal/komputer, punya akses sistem + internet + Git + Vercel CLI)
- File `Catatan_Update_Blueprint.md` ini dibawa ke Claude Code sebagai konteks — semua keputusan desain/database/fitur/konvensi sudah terdokumentasi, tinggal eksekusi
- Sandbox chat ini TIDAK punya akses internet, jadi tidak bisa deploy/push/upload dari sini

---

## 25. Yang Masih Perlu Diputuskan / Dikerjakan Selanjutnya

- [ ] Implementasi Supabase Edge Function untuk panggil Groq API dengan aman
- [ ] Bangun `lib/tiktok/parser.js`, `metrics.js`, `sync.js` — parsing file upload jadi insert ke tabel yang sudah dibuat (extract video ID dari URL, mapping bulan Indonesia, deduplikasi)
- [ ] Migrasi `tiktok_accounts` → `social_accounts` dengan kolom `platform` (generik, siap untuk Instagram nanti)
- [ ] Instagram: validasi cara ambil data — ditunda sampai TikTok selesai
- [ ] Hubungkan generator PDF (per-akun & semua cabang) ke data asli, bukan dummy
- [ ] Log histori evaluasi mingguan/bulanan
- [ ] Sheet "Ringkasan Semua Cabang" di file Excel
- [ ] Definisikan ambang batas resmi untuk status "Naik/Stabil/Turun" per cabang
- [ ] Konversi mockup tema dashboard jadi kode HTML/CSS/component
- [ ] Konfirmasi lisensi Freepik untuk aset desain yang dipakai
- [ ] Aktifkan "Leaked Password Protection" di pengaturan Auth Supabase (manual lewat dashboard)
- [ ] Preview/thumbnail video via TikTok oEmbed — perlu validasi endpoint masih aktif
