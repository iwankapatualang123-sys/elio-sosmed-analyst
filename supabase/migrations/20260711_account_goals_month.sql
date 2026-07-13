-- Migration: target/goal jadi PER-BULAN (selain per cabang & platform).
-- Tambah kolom target_month ('YYYY-MM'); PK jadi (cabang, platform, target_month).
-- Baris lama (target all-time) di-backfill ke bulan berjalan supaya tidak hilang.

alter table public.tiktok_account_goals
  add column if not exists target_month text;

update public.tiktok_account_goals
  set target_month = to_char(now(), 'YYYY-MM')
  where target_month is null;

alter table public.tiktok_account_goals
  alter column target_month set not null;

alter table public.tiktok_account_goals drop constraint if exists tiktok_account_goals_pkey;
alter table public.tiktok_account_goals
  add constraint tiktok_account_goals_pkey primary key (tiktok_account_id, platform, target_month);
