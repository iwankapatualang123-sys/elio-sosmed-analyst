# Elio Sosmed Analyst

Aplikasi analitik TikTok multi-cabang untuk internal Elio Agency. Upload manual
file export TikTok Studio → parsing → simpan ke Supabase → dashboard analitik.
Detail keputusan desain/fitur ada di [`Catatan_Update_Blueprint.md`](./Catatan_Update_Blueprint.md).

## Stack

- **Next.js 16** (App Router, JavaScript), **Tailwind v4**, PWA (installable + offline)
- **Supabase** (Postgres + Auth + RLS) — project `Digihub`
- Parsing xlsx: `exceljs` · unzip: `fflate`

## Struktur kode penting

```
lib/tiktok/        parser.js  -> parse export TikTok Studio (xlsx) ke bentuk baris DB
                   sync.js    -> upsert hasil parse ke Supabase (dedup)
                   metrics.js -> engagement rate, ranking, hashtag, growth, dll
                   upload.js  -> bongkar arsip (zip bersarang) -> parse -> sync
                   analytics.js -> muat data + hitung metrik untuk dashboard
lib/supabase/      client/server/middleware -> client Supabase (SSR, cookie)
app/               login, dashboard, upload, api/upload
components/        Nav, MetricCard, Charts, UploadClient, Button, ...
supabase/migrations/ -> perubahan schema (trigger profil, dll)
```

Konvensi: kode pemroses dipisah per platform; setiap file & fungsi diberi komentar
(Bahasa Indonesia). Lihat blueprint bagian 16.

## Setup lokal

```bash
npm install
cp .env.local.example .env.local   # isi URL + anon/publishable key Supabase
npm run dev                        # http://localhost:3000
```

Environment variables (lihat `.env.local.example`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable/anon key — aman di browser, dilindungi RLS)

## Tes

```bash
npm test            # semua tes lib/tiktok (parser, sync, metrics, upload)
npm run build       # production build
npm run lint
```

## Deploy ke Vercel

1. Push repo ke GitHub (sudah terhubung).
2. Di Vercel: **New Project** → import repo ini.
3. **Environment Variables**: tambahkan `NEXT_PUBLIC_SUPABASE_URL` dan
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (nilai dari `.env.local`).
4. Deploy. Setiap push ke `main` → auto-deploy.

> Jangan taruh service-role key atau Groq key sebagai `NEXT_PUBLIC_*` (terekspos ke
> browser). Key rahasia server diatur terpisah (Supabase Edge Function secret).

## Role & akses

3 role (`admin`/`manager`/`staff`) via RLS `can_access_account`. Admin lihat semua
cabang; upload data hanya admin & manager. User baru otomatis dapat profil role
`staff` (trigger `handle_new_user`), lalu dipromosikan admin.
