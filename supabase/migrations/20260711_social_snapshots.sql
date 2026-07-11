-- Migration: Snapshot akun sosmed NON-TikTok (input manual mingguan) — Lapis 1
-- laporan Instagram/Threads. IG tidak menyediakan export report seperti TikTok
-- Studio, jadi perkembangan akun dicatat manual sebagai DERET WAKTU bertanggal
-- (bukan menimpa angka lama) supaya minggu yang bolong tetap jujur terlihat.
-- Generik per platform: kolom `platform` — Threads ikut tanpa tabel baru, dan
-- kelak Meta Graph API tinggal mengisi tabel yang sama menggantikan input manual.

create table if not exists public.social_account_snapshots (
  id bigint generated always as identity primary key,
  tiktok_account_id uuid not null references public.tiktok_accounts(id) on delete cascade,
  platform text not null check (platform in ('instagram','threads')),
  snapshot_date date not null,               -- tanggal angka diambil dari layar Insights
  followers integer,                          -- wajib diisi dari aplikasi (metrik utama)
  reach_30d integer,                          -- opsional: reach 30 hari terakhir
  profile_visits integer,                     -- opsional: kunjungan profil 30 hari
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tiktok_account_id, platform, snapshot_date)  -- 1 angka per akun/platform/hari (upsert)
);
create index if not exists idx_social_snapshots_acc
  on public.social_account_snapshots (tiktok_account_id, platform, snapshot_date desc);

alter table public.social_account_snapshots enable row level security;

-- Pola RLS sama dengan content_plans: baca = punya akses cabang; tulis = pemilik
-- baris / admin / manager (staff hanya melihat, konsisten dgn halaman Upload).
drop policy if exists "snap_read" on public.social_account_snapshots;
create policy "snap_read" on public.social_account_snapshots
  for select to authenticated using (public.can_access_account(tiktok_account_id));

drop policy if exists "snap_insert" on public.social_account_snapshots;
create policy "snap_insert" on public.social_account_snapshots
  for insert to authenticated
  with check (public.can_access_account(tiktok_account_id) and created_by = auth.uid());

drop policy if exists "snap_update" on public.social_account_snapshots;
create policy "snap_update" on public.social_account_snapshots
  for update to authenticated
  using (public.can_access_account(tiktok_account_id)
    and (created_by = auth.uid() or public.current_user_role() = 'admin' or public.current_user_role() = 'manager'))
  with check (public.can_access_account(tiktok_account_id)
    and (created_by = auth.uid() or public.current_user_role() = 'admin' or public.current_user_role() = 'manager'));

drop policy if exists "snap_delete" on public.social_account_snapshots;
create policy "snap_delete" on public.social_account_snapshots
  for delete to authenticated
  using (public.can_access_account(tiktok_account_id)
    and (created_by = auth.uid() or public.current_user_role() = 'admin'));
