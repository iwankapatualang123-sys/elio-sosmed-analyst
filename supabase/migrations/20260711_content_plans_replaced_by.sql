-- Migration: tautan "rencana pengganti". Ketika sebuah rencana diganti rencana lain,
-- kolom ini menunjuk ke id rencana penggantinya, dan status_override diset 'Replaced'.
-- ON DELETE SET NULL: kalau rencana pengganti dihapus, tautan lepas (rencana lama tidak
-- ikut terhapus). Dipakai model 5 status: On Going / Uploaded / Verified / Cancelled /
-- Replaced (lihat lib/tiktok/content-plan.js).
-- Diterapkan ke project msisofuggqoodlwjqxzw 2026-07-11.
alter table public.content_plans
  add column if not exists replaced_by_id bigint references public.content_plans(id) on delete set null;

create index if not exists content_plans_replaced_by_id_idx on public.content_plans(replaced_by_id);
