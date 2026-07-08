-- Migration: trigger pembuat profil otomatis saat user auth baru dibuat.
-- Diterapkan ke project Digihub (msisofuggqoodlwjqxzw) 2026-07-09.
-- Catatan: seed data (cabang pertama + promosi admin) diterapkan sebagai one-off
-- terpisah, tidak dimasukkan ke migration ini agar tidak berisi email spesifik.

-- Profil (role default 'staff') dibuat otomatis tiap ada user baru di auth.users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger jalan sebagai owner tabel; anon/authenticated tidak perlu memanggilnya
-- lewat RPC. Revoke EXECUTE supaya tidak terekspos di API (pola keamanan bagian 13).
revoke execute on function public.handle_new_user() from anon, authenticated, public;
