-- Migration: Content Plan / Rencana Konten editorial (meniru sheet Excel "Content Plan").
-- Kalender rencana produksi konten per cabang: PIC, hook, pillar, goals, approval, dll.
-- Status "Uploaded/Work in Progress" DIHITUNG otomatis di aplikasi dengan mencocokkan
-- Headline/Hook ke judul konten yang sudah tayang (tabel tiktok_content) — jadi tidak
-- disimpan sebagai kolom, kecuali `status_override` (opsional, untuk koreksi manual).
-- Diterapkan ke project msisofuggqoodlwjqxzw 2026-07-09.

create table if not exists public.content_plans (
  id bigint generated always as identity primary key,
  tiktok_account_id uuid not null references public.tiktok_accounts(id) on delete cascade,
  plan_month date not null,          -- tanggal 1 bulan rencana (grouping "Bulan")
  post_date date,                    -- tanggal rencana upload ("Post")
  seq integer,                       -- nomor urut tampil ("No")
  pic text,                          -- penanggung jawab (DHYAS/ENDIN/...)
  headline text,                     -- Headline/Hook (kunci match ke konten tayang)
  topic text,                        -- Topic/Redaksi (brief footage/naskah)
  goals_content text,                -- Awareness/Engagement/Consideration/Conversion
  primary_pillar text,               -- pillar utama
  secondary_pillar text,             -- pillar sekunder
  content_type text,                 -- Video/Carousel/Single Image/Story
  reference_url text,                -- link referensi
  notes text,                        -- Keterangan/Konten Pengganti
  acc_to_posting boolean not null default false,  -- ACC siap tayang (checkbox)
  status_override text,              -- kosong = status otomatis; isi = paksa status
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_content_plans_acc_month on public.content_plans (tiktok_account_id, plan_month);

alter table public.content_plans enable row level security;

-- read: siapa pun dengan akses cabang
drop policy if exists "cplan_read" on public.content_plans;
create policy "cplan_read" on public.content_plans
  for select to authenticated using (public.can_access_account(tiktok_account_id));

-- insert: akses cabang & baris dimiliki dirinya sendiri
drop policy if exists "cplan_insert" on public.content_plans;
create policy "cplan_insert" on public.content_plans
  for insert to authenticated
  with check (public.can_access_account(tiktok_account_id) and created_by = auth.uid());

-- update: pemilik baris atau admin/manager
drop policy if exists "cplan_update" on public.content_plans;
create policy "cplan_update" on public.content_plans
  for update to authenticated
  using (public.can_access_account(tiktok_account_id)
    and (created_by = auth.uid() or public.current_user_role() = 'admin' or public.current_user_role() = 'manager'))
  with check (public.can_access_account(tiktok_account_id)
    and (created_by = auth.uid() or public.current_user_role() = 'admin' or public.current_user_role() = 'manager'));

-- delete: pemilik baris atau admin
drop policy if exists "cplan_delete" on public.content_plans;
create policy "cplan_delete" on public.content_plans
  for delete to authenticated
  using (public.can_access_account(tiktok_account_id)
    and (created_by = auth.uid() or public.current_user_role() = 'admin'));
