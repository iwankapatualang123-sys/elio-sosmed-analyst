# Deploy ke Server Sendiri (aaPanel) — MySQL + Prisma + PM2

Panduan memindahkan **elio-sosmed-analyst** dari **Vercel + Supabase** ke
**server aaPanel sendiri** dengan **database MySQL**, mengikuti pola aplikasi
aaPanel Anda yang lain (`elio-absensi-aapanel`).

> **Ringkas:** database Supabase (Postgres) → **MySQL**, akses data lewat
> **Prisma**, autentikasi Supabase → **JWT cookie sendiri**, RLS → **cek akses di
> kode**. Next.js tetap dipakai apa adanya dan jalan lewat **PM2** (Next.js sudah
> jadi server-nya sendiri — tidak perlu backend Express terpisah seperti absensi
> yang berbasis Vite SPA).

---

## 0. Perubahan dibanding versi Supabase

| Lapisan | Sebelum (Vercel) | Sesudah (aaPanel) |
|---|---|---|
| Database | Supabase Postgres | **MySQL** (aaPanel Database Manager) |
| Akses data | `supabase.from()` | **Prisma** (`lib/db.js`) |
| Auth | Supabase Auth (GoTrue) | **JWT cookie** (`lib/auth-jwt.js`), hash bcrypt |
| Keamanan data | Postgres RLS | Cek akses di kode (`user_branch_access`) |
| Runtime | Vercel serverless | **Next.js `npm start`** via PM2 |
| Web server | Vercel edge | **Nginx** reverse proxy + SSL |

> **Sadari konsekuensinya:** setelah lepas dari layanan terkelola, **backup,
> update keamanan, dan uptime jadi tanggung jawab Anda.** Siapkan cron backup
> (langkah 7) sejak hari pertama — Supabase tidak lagi mem-backup otomatis.

---

## 1. Siapkan server (aaPanel)

1. Server Linux, RAM **≥ 2 GB**. Bisa server yang sama dengan app aaPanel lain.
2. Dari **App Store** aaPanel pastikan terpasang:
   - **Node.js** versi **22** (aplikasi butuh Node ≥ 22),
   - **MySQL** 8.x,
   - **Nginx** (reverse proxy + SSL),
   - **PM2** (via Node.js manager aaPanel, atau `npm i -g pm2`).
3. Arahkan 1 subdomain ke IP server (DNS A record), mis.
   `sosmed.eliodigihub.my.id`.

---

## 2. Buat database MySQL

Di aaPanel → **Databases** → *Add database*:

- Nama database: `elio_sosmed`
- Buat **user DB khusus** (bukan root), catat password-nya.
- Charset: `utf8mb4`.

`DATABASE_URL` nanti berbentuk:
```
mysql://elio_sosmed:PASSWORD@127.0.0.1:3306/elio_sosmed
```

---

## 3. Deploy kode & siapkan skema

```bash
# clone repo ke server
git clone <repo-anda> /www/wwwroot/elio-sosmed-analyst
cd /www/wwwroot/elio-sosmed-analyst
cp .env.example .env.local
```

Isi `.env.local` (lihat `.env.example`):

```
DATABASE_URL=mysql://elio_sosmed:PASSWORD@127.0.0.1:3306/elio_sosmed
AUTH_JWT_SECRET=<hasil: node scripts/gen-secret.mjs>
GROQ_API_KEY=<opsional, untuk Insight AI>
```

Install, buat tabel, generate client:

```bash
npm ci
npx prisma migrate deploy   # buat 18 tabel di MySQL dari prisma/migrations
npx prisma generate
```

> Kalau `prisma/migrations` belum ada (baru pakai schema), sekali saja jalankan
> di mesin dev: `npx prisma migrate dev --name init` untuk membuat file migrasi,
> commit, lalu di server cukup `migrate deploy`.

---

## 4. Pindahkan data dari Supabase

**a. Data tabel** (18 tabel) — dari server yang punya akses ke keduanya:

```bash
export SRC_SUPABASE_URL="https://<ref>.supabase.co"
export SRC_SUPABASE_SERVICE_KEY="<service_role key Supabase lama>"
export DATABASE_URL="mysql://elio_sosmed:PASSWORD@127.0.0.1:3306/elio_sosmed"

node scripts/migrate-supabase-to-mysql.mjs
```

Skrip membaca semua baris via service-role (bypass RLS) dan meng-upsert ke MySQL
lewat Prisma, dengan urutan aman-FK. **Idempotent** — aman dijalankan ulang
mendekati waktu cutover supaya data terbaru ikut.

**b. Password login** (opsional, supaya user tak perlu reset) — di Supabase SQL
editor jalankan:

```sql
select json_agg(json_build_object(
  'id', id, 'email', email, 'encrypted_password', encrypted_password
)) from auth.users;
```

Simpan hasilnya ke `auth_users.json` di folder kerja, lalu jalankan ulang skrip
migrasi. Hash bcrypt Supabase (`$2a$…`) kompatibel dengan verifikasi kita, jadi
password lama tetap berlaku. (Kalau dilewati, buat/reset password lewat halaman
Pengaturan.)

**c. Verifikasi:**

```bash
npx prisma studio   # buka via SSH tunnel; cek tabel tiktok_accounts, profiles, dll terisi
```

---

## 5. Jalankan aplikasi (PM2)

```bash
npm run build          # build Next.js produksi
pm2 start npm --name elio-sosmed -- start
pm2 save && pm2 startup
```

Next.js jalan di port **3000** (ubah dengan `-- start -p 3xxx` bila bentrok
dengan app lain di server — mis. absensi backend di 3900).

> ⚠️ Kalau folder kode pernah dipindah, `pm2 restart` tidak cukup — `pm2 delete
> elio-sosmed` lalu `pm2 start` ulang dari folder yang benar, baru `pm2 save`.

---

## 6. Nginx reverse proxy + SSL

Di aaPanel: **Add site** `sosmed.eliodigihub.my.id` (tanpa program, root default),
lalu **Reverse Proxy** ke `http://127.0.0.1:3000`, aktifkan **SSL (Let's
Encrypt)**. Uji:

- **Login** (akun lama tetap jalan bila password sudah dimigrasi),
- **Upload** TikTok & Instagram,
- **Akses per-cabang** (user staff hanya lihat cabangnya),
- **Insight AI** (bila pakai Groq).

---

## 7. Backup (WAJIB — tidak ada lagi backup otomatis)

Cron harian `mysqldump`:

```bash
0 2 * * *  mysqldump -u elio_sosmed -pPASSWORD elio_sosmed \
  | gzip > /www/backup/elio_sosmed_$(date +\%F).sql.gz
```

Simpan 7–14 hari, sesekali unduh ke luar server.

---

## 8. Cutover & matikan Supabase

1. Jalankan ulang skrip migrasi data mendekati waktu cutover (ambil data terbaru).
2. Alihkan pemakaian staf ke domain aaPanel.
3. Amati 1–2 minggu. Setelah yakin stabil, matikan auto-deploy Vercel & pause
   project Supabase.

> **Catatan:** project Supabase "Digihub" dipakai bersama beberapa aplikasi Anda
> (Digihub mainpage, HPP, dll). **Jangan hapus project Supabase** selama app lain
> masih memakainya — cukup berhenti memakai tabel sosmed dari sisi app ini.

---

## Catatan gotcha

- **`AUTH_JWT_SECRET` harus tetap sama** setelah di-set — kalau berubah, semua
  sesi login batal (user harus login ulang). Jangan regenerate sembarangan.
- **`prisma generate` wajib setelah `npm ci`** di server (client tidak ikut
  ter-commit). Sudah otomatis bila ada `postinstall`, kalau tidak jalankan manual.
- **`sharp`** (resize thumbnail) native di Node server — pastikan tidak di-skip
  saat `npm ci`.
- **`vercel.json`** boleh dibiarkan; diabaikan di luar Vercel.
- **Zona waktu:** MySQL simpan `DATETIME` apa adanya. Pastikan server & MySQL
  konsisten (disarankan UTC) supaya perhitungan tanggal harian tidak geser.
