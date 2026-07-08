-- Migration: target/goal per cabang (blueprint 21A).
-- Diterapkan ke project Digihub (msisofuggqoodlwjqxzw) 2026-07-09.

create table if not exists public.tiktok_account_goals (
  tiktok_account_id uuid primary key references public.tiktok_accounts(id) on delete cascade,
  target_total_views integer,
  target_engagement_rate numeric,
  target_net_followers integer,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.tiktok_account_goals enable row level security;

drop policy if exists "goals_read" on public.tiktok_account_goals;
create policy "goals_read" on public.tiktok_account_goals
  for select to authenticated using (public.can_access_account(tiktok_account_id));

drop policy if exists "goals_insert" on public.tiktok_account_goals;
create policy "goals_insert" on public.tiktok_account_goals
  for insert to authenticated
  with check (public.can_access_account(tiktok_account_id)
    and (public.current_user_role() = 'admin' or public.current_user_role() = 'manager'));

drop policy if exists "goals_update" on public.tiktok_account_goals;
create policy "goals_update" on public.tiktok_account_goals
  for update to authenticated
  using (public.can_access_account(tiktok_account_id)
    and (public.current_user_role() = 'admin' or public.current_user_role() = 'manager'))
  with check (public.can_access_account(tiktok_account_id)
    and (public.current_user_role() = 'admin' or public.current_user_role() = 'manager'));
