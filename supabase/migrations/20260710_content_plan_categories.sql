-- Migration: kategori Rencana Konten (PIC/Goals/Pillar/Type) dikelola dari UI
-- Pengaturan, bukan lagi konstanta tetap di kode. Nilai awal disalin dari Data
-- Validation resmi sheet Excel "Content Plan" (lihat lib/tiktok/content-plan.js).
-- Diterapkan ke project msisofuggqoodlwjqxzw 2026-07-10.

create table if not exists public.content_plan_categories (
  id bigint generated always as identity primary key,
  category_type text not null check (category_type in ('pic', 'goals', 'pillar', 'type')),
  value text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (category_type, value)
);

alter table public.content_plan_categories enable row level security;

-- Baca: semua user login (dipakai isi dropdown form Rencana Konten).
drop policy if exists "cpcat_read" on public.content_plan_categories;
create policy "cpcat_read" on public.content_plan_categories
  for select to authenticated using (true);

-- Tulis (tambah/hapus kategori): admin saja — sejalan dgn halaman Pengaturan yang admin-only.
drop policy if exists "cpcat_insert" on public.content_plan_categories;
create policy "cpcat_insert" on public.content_plan_categories
  for insert to authenticated
  with check (public.current_user_role() = 'admin');

drop policy if exists "cpcat_delete" on public.content_plan_categories;
create policy "cpcat_delete" on public.content_plan_categories
  for delete to authenticated
  using (public.current_user_role() = 'admin');

-- Seed nilai resmi dari Excel supaya tidak ada regresi setelah pindah dari konstanta.
insert into public.content_plan_categories (category_type, value) values
  ('pic', 'DHYAS'), ('pic', 'ITA'), ('pic', 'ENDIN'),
  ('goals', 'Awareness'), ('goals', 'Engagement'),
  ('pillar', 'Awareness'), ('pillar', 'Entertaint'), ('pillar', 'Branding Person (Promotion)'), ('pillar', 'Product knowledge'),
  ('type', 'Single Image'), ('type', 'Carousel'), ('type', 'Video')
on conflict (category_type, value) do nothing;
