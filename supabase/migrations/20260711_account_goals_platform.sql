-- Migration: target/goal jadi PER-PLATFORM (TikTok/Instagram) per cabang.
-- Sebelumnya 1 baris per cabang (implisit TikTok). Tambah kolom `platform` dan
-- ganti primary key jadi komposit (tiktok_account_id, platform). Baris lama jadi
-- platform='tiktok'. Dikelola di halaman Pengaturan; progress tampil di Dashboard.

alter table public.tiktok_account_goals
  add column if not exists platform text not null default 'tiktok';

-- Ganti PK tunggal -> komposit (cabang, platform).
alter table public.tiktok_account_goals drop constraint if exists tiktok_account_goals_pkey;
alter table public.tiktok_account_goals
  add constraint tiktok_account_goals_pkey primary key (tiktok_account_id, platform);

alter table public.tiktok_account_goals
  add constraint tiktok_account_goals_platform_chk check (platform in ('tiktok','instagram'));
