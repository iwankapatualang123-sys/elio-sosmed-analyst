-- Migration: anotasi/catatan tanggal per cabang (blueprint 21A). 2026-07-09.
create table if not exists public.branch_annotations (
  id bigint generated always as identity primary key,
  tiktok_account_id uuid not null references public.tiktok_accounts(id) on delete cascade,
  note_date date not null,
  note text not null,
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now()
);
create index if not exists idx_branch_annotations_acc_date on public.branch_annotations (tiktok_account_id, note_date desc);

alter table public.branch_annotations enable row level security;

drop policy if exists "annot_read" on public.branch_annotations;
create policy "annot_read" on public.branch_annotations
  for select to authenticated using (public.can_access_account(tiktok_account_id));

drop policy if exists "annot_insert" on public.branch_annotations;
create policy "annot_insert" on public.branch_annotations
  for insert to authenticated
  with check (public.can_access_account(tiktok_account_id) and created_by = auth.uid());

drop policy if exists "annot_delete" on public.branch_annotations;
create policy "annot_delete" on public.branch_annotations
  for delete to authenticated
  using (public.can_access_account(tiktok_account_id)
    and (created_by = auth.uid() or public.current_user_role() = 'admin'));
