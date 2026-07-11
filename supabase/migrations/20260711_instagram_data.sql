-- Migration: Data Instagram dari export Meta Business Suite (Tahap A).
-- Dua tabel:
--   instagram_daily_metrics : metrik akun PER HARI (views/reach/profile_visits/
--     new_followers/interactions) — dari file harian UTF-16. Unique per
--     (cabang, metrik, tanggal) -> upload tumpang tindih aman (upsert).
--   instagram_content : 1 baris per post/reel/story dari export per konten.
--     Angka bersifat "Sepanjang Masa" (kumulatif saat export) -> upload ulang
--     MEMPERBARUI baris yang sama (upsert per cabang+post_id). Konten kolaborasi
--     akun lain ditandai is_collab. permalink dipakai verifikasi Rencana Konten.

create table if not exists public.instagram_daily_metrics (
  id bigint generated always as identity primary key,
  tiktok_account_id uuid not null references public.tiktok_accounts(id) on delete cascade,
  metric text not null check (metric in ('views','reach','profile_visits','new_followers','interactions')),
  date date not null,
  value integer not null,
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tiktok_account_id, metric, date)
);
create index if not exists idx_ig_daily_acc on public.instagram_daily_metrics (tiktok_account_id, metric, date desc);

create table if not exists public.instagram_content (
  id bigint generated always as identity primary key,
  tiktok_account_id uuid not null references public.tiktok_accounts(id) on delete cascade,
  post_id text not null,
  ig_account_id text,
  username text,
  account_name text,
  description text,
  duration_s integer,
  published_at timestamptz,
  permalink text,
  post_type text,                 -- 'Reel IG' / 'Gambar IG' / 'Carousel IG' / 'Cerita IG'
  views integer,
  reach integer,
  likes integer,
  comments integer,
  shares integer,
  saves integer,
  profile_visits integer,
  replies integer,                -- khusus Story
  navigation integer,             -- khusus Story
  sticker_taps integer,           -- khusus Story
  follows integer,                -- follower baru dari konten ini (metrik emas)
  is_collab boolean not null default false,
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tiktok_account_id, post_id)
);
create index if not exists idx_ig_content_acc on public.instagram_content (tiktok_account_id, published_at desc);

alter table public.instagram_daily_metrics enable row level security;
alter table public.instagram_content enable row level security;

-- Pola RLS sama dgn tabel data lain: baca = akses cabang; tulis = pemilik baris
-- atau admin/manager (staff hanya melihat).
drop policy if exists "igd_read" on public.instagram_daily_metrics;
create policy "igd_read" on public.instagram_daily_metrics
  for select to authenticated using (public.can_access_account(tiktok_account_id));
drop policy if exists "igd_insert" on public.instagram_daily_metrics;
create policy "igd_insert" on public.instagram_daily_metrics
  for insert to authenticated
  with check (public.can_access_account(tiktok_account_id) and created_by = auth.uid());
drop policy if exists "igd_update" on public.instagram_daily_metrics;
create policy "igd_update" on public.instagram_daily_metrics
  for update to authenticated
  using (public.can_access_account(tiktok_account_id)
    and (created_by = auth.uid() or public.current_user_role() = 'admin' or public.current_user_role() = 'manager'))
  with check (public.can_access_account(tiktok_account_id)
    and (created_by = auth.uid() or public.current_user_role() = 'admin' or public.current_user_role() = 'manager'));
drop policy if exists "igd_delete" on public.instagram_daily_metrics;
create policy "igd_delete" on public.instagram_daily_metrics
  for delete to authenticated
  using (public.can_access_account(tiktok_account_id)
    and (created_by = auth.uid() or public.current_user_role() = 'admin'));

drop policy if exists "igc_read" on public.instagram_content;
create policy "igc_read" on public.instagram_content
  for select to authenticated using (public.can_access_account(tiktok_account_id));
drop policy if exists "igc_insert" on public.instagram_content;
create policy "igc_insert" on public.instagram_content
  for insert to authenticated
  with check (public.can_access_account(tiktok_account_id) and created_by = auth.uid());
drop policy if exists "igc_update" on public.instagram_content;
create policy "igc_update" on public.instagram_content
  for update to authenticated
  using (public.can_access_account(tiktok_account_id)
    and (created_by = auth.uid() or public.current_user_role() = 'admin' or public.current_user_role() = 'manager'))
  with check (public.can_access_account(tiktok_account_id)
    and (created_by = auth.uid() or public.current_user_role() = 'admin' or public.current_user_role() = 'manager'));
drop policy if exists "igc_delete" on public.instagram_content;
create policy "igc_delete" on public.instagram_content
  for delete to authenticated
  using (public.can_access_account(tiktok_account_id)
    and (created_by = auth.uid() or public.current_user_role() = 'admin'));
