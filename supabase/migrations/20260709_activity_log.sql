-- Migration: audit trail (activity_log). Blueprint bagian 21B.
-- Diterapkan ke project Digihub (msisofuggqoodlwjqxzw) 2026-07-09.

create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id),
  user_email text,
  action text not null,
  entity text,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_log_created on public.activity_log (created_at desc);

alter table public.activity_log enable row level security;

-- User boleh menyisipkan log atas namanya sendiri; hanya admin yang boleh membaca.
drop policy if exists "activity_insert_own" on public.activity_log;
create policy "activity_insert_own" on public.activity_log
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "activity_admin_read" on public.activity_log;
create policy "activity_admin_read" on public.activity_log
  for select to authenticated using (public.current_user_role() = 'admin');
