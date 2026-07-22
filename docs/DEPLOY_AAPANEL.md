# Deploy ke Server Sendiri (aaPanel) + Database Sendiri

Panduan memindahkan **elio-sosmed-analyst** dari Vercel + Supabase Cloud ke
**server sendiri via aaPanel**, dengan **database pindah** juga.

> **Ringkas:** kode aplikasi TIDAK perlu diubah. Semua koneksi Supabase lewat
> environment variable, jadi cukup arahkan env ke database baru + jalankan
> Next.js di server. Bagian tersulit adalah **database**, bukan aplikasinya.

---

## 0. Keputusan penting: database mau seperti apa?

Aplikasi ini memakai **Supabase** bukan cuma sebagai Postgres, tapi juga untuk
**Auth (login/role)** dan **RLS (keamanan data per cabang)**. Ada 2 jalur:

| Jalur | Usaha | Rekomendasi |
|---|---|---|
| **A. Self-host Supabase** (Docker) di server | Sedang | ✅ **Dipakai panduan ini.** Kode aplikasi TIDAK berubah — tinggal ganti env. Auth + RLS ikut pindah utuh. |
| **B. PostgreSQL biasa saja** (tanpa Supabase) | Besar | ❌ Harus tulis ulang seluruh login, role, dan RLS. Tidak disarankan. |

Panduan di bawah memakai **Jalur A**.

> **Sadari konsekuensinya:** setelah pindah dari layanan terkelola, **backup,
> update keamanan, dan uptime jadi tanggung jawab Anda.** Siapkan cron backup
> (langkah 6) sejak hari pertama.

---

## 1. Siapkan server (aaPanel)

1. Server Linux (Ubuntu 22.04+ disarankan), RAM **≥ 4 GB** (Supabase + Next.js).
2. Pasang aaPanel, lalu dari **App Store** aaPanel:
   - **Docker Manager** (untuk Supabase),
   - **Node.js** versi **22** (aplikasi butuh Node ≥ 22),
   - **Nginx** (biasanya sudah ada — dipakai reverse proxy + SSL).
3. Arahkan 2 subdomain ke IP server (DNS A record):
   - `app.domain-anda.com`  → aplikasi Next.js
   - `db.domain-anda.com`   → API Supabase

---

## 2. Self-host Supabase (Docker)

```bash
# di server, sebagai user biasa
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
```

Edit `.env` (minimal yang WAJIB diganti dari default):

- `POSTGRES_PASSWORD` — password Postgres (kuat & unik).
- `JWT_SECRET` — string acak ≥ 40 karakter.
- `ANON_KEY` & `SERVICE_ROLE_KEY` — generate dari `JWT_SECRET`.
- `SITE_URL=https://app.domain-anda.com`
- `API_EXTERNAL_URL=https://db.domain-anda.com`
- `SUPABASE_PUBLIC_URL=https://db.domain-anda.com`
- Ganti password default lain (`DASHBOARD_PASSWORD`, dll).

**Cara cepat generate semua kunci + password** (dijalankan di mesin mana pun
yang punya Node — repo ini menyediakan skrip tanpa dependensi):

```bash
node scripts/gen-supabase-keys.mjs
```

Skrip itu mencetak blok siap-tempel untuk `supabase/docker/.env` (JWT_SECRET,
ANON_KEY, SERVICE_ROLE_KEY, POSTGRES_PASSWORD, DASHBOARD_PASSWORD) **dan** blok
untuk `.env.local` aplikasi (ANON_KEY + SERVICE_ROLE_KEY yang sama). Isi sendiri
bagian domain (`SITE_URL` dll). Simpan hasilnya baik-baik — jangan di-commit.

Jalankan:

```bash
docker compose up -d
docker compose ps   # pastikan semua "healthy"
```

Di aaPanel: buat situs `db.domain-anda.com` → **Reverse Proxy** ke
`http://127.0.0.1:8000` (port Kong/Supabase) → aktifkan **SSL (Let's Encrypt)**.

> Studio (admin DB) ada di port `3000` internal Supabase — JANGAN diekspos publik
> tanpa proteksi. Akses via SSH tunnel atau batasi IP.

---

## 3. Pindahkan data dari Supabase Cloud

**a. Ambil connection string sumber** dari dashboard Supabase Cloud lama:
Settings → Database → *Connection string* (mode **Session/direct**, bukan pooler).

**b. Dump schema + data** (dari mesin mana pun yang punya `pg_dump` v15+):

```bash
# Skema public (tabel aplikasi) + skema auth (user & password login)
pg_dump "postgresql://postgres:PASS@db.<ref>.supabase.co:5432/postgres" \
  --schema=public --schema=auth \
  --no-owner --no-privileges \
  -f elio_dump.sql
```

**c. Restore ke Supabase self-host:**

```bash
# konek ke Postgres self-host (port 5432 di server, atau via docker exec)
psql "postgresql://postgres:POSTGRES_PASSWORD@127.0.0.1:5432/postgres" -f elio_dump.sql
```

> Karena skema `auth` ikut dipindah, **semua user + password lama tetap bisa
> login** (hash password ada di `auth.users`). RLS & trigger juga ikut karena
> ada di skema `public`.
>
> Alternatif skema saja: jalankan berurutan file di `supabase/migrations/`,
> lalu dump **data** saja (`--data-only`) dari sumber untuk diisi.

**d. Verifikasi:** buka Studio self-host, cek tabel `tiktok_accounts`,
`instagram_content`, `profiles`, dll terisi.

---

## 4. Deploy aplikasi Next.js di aaPanel

```bash
# clone repo ke server
git clone <repo-anda> /www/wwwroot/elio-sosmed-analyst
cd /www/wwwroot/elio-sosmed-analyst
cp .env.example .env.local
```

Isi `.env.local` dengan nilai **self-host** (lihat .env.example):

```
NEXT_PUBLIC_SUPABASE_URL=https://db.domain-anda.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY self-host>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY self-host>
GROQ_API_KEY=<opsional>
```

Build & jalankan:

```bash
npm ci
npm run build          # NEXT_PUBLIC_* di-bake di sini — env harus sudah benar!
npm start              # jalan di port 3000
```

Supaya tetap hidup, jalankan lewat **PM2** (dari aaPanel Node.js project atau
manual):

```bash
pm2 start npm --name elio -- start
pm2 save && pm2 startup
```

Di aaPanel: situs `app.domain-anda.com` → **Reverse Proxy** ke
`http://127.0.0.1:3000` → aktifkan **SSL (Let's Encrypt)**.

---

## 5. Konfigurasi akhir

1. Di Supabase self-host `.env`, pastikan `SITE_URL` = domain app, lalu
   `docker compose restart` bila diubah — supaya link reset password / redirect
   auth mengarah ke domain baru.
2. Uji: **login**, **upload** data TikTok & Instagram, **RLS** (user staff cuma
   lihat cabang-nya), **backup** (halaman Pengaturan), **Insight AI** (bila pakai Groq).
3. Matikan auto-deploy Vercel lama bila sudah yakin (atau simpan sebagai cadangan).

---

## 6. Backup (WAJIB — tidak ada lagi backup otomatis)

Cron harian `pg_dump` ke folder aman (atau storage eksternal):

```bash
0 2 * * *  pg_dump "postgresql://postgres:POSTGRES_PASSWORD@127.0.0.1:5432/postgres" \
  | gzip > /www/backup/elio_$(date +\%F).sql.gz
```

Simpan minimal 7–14 hari, dan sesekali unduh ke luar server.

---

## Catatan gotcha

- **`NEXT_PUBLIC_SUPABASE_URL` di-bake saat build.** Kalau ganti URL DB, **build
  ulang** aplikasinya — tidak cukup restart.
- **`vercel.json`** boleh dibiarkan; diabaikan di luar Vercel.
- **`sharp`** (resize thumbnail) jalan native di Node server — pastikan tidak
  di-skip saat `npm ci`.
- File API (`/api/report/*`, `/api/upload`, `/api/tiktok-thumbnail`) berjalan di
  Node server aaPanel, sama seperti di Vercel.
