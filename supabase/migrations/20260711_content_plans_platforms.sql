-- Migration: Rencana Konten multi-platform (TikTok / Instagram / Threads).
-- 1 rencana bisa tayang di beberapa platform. TikTok tetap pakai kolom lama
-- `posted_url` (verifikasi otomatis vs data report); IG/Threads hanya berbasis
-- link (belum ada sumber data report resminya) di jsonb `platform_links`.
-- Data lama: default '{tiktok}' -> perilaku tidak berubah.

alter table public.content_plans
  add column if not exists platforms text[] not null default array['tiktok']::text[],
  add column if not exists platform_links jsonb not null default '{}'::jsonb;

comment on column public.content_plans.platforms is 'Platform target rencana: tiktok/instagram/threads (min. 1).';
comment on column public.content_plans.platform_links is 'Link tayang per platform NON-TikTok, mis. {"instagram":"https://...","threads":"https://..."}. Link TikTok tetap di posted_url.';
