// File: lib/supabase/server.js
// Tujuan: membuat client Supabase untuk sisi SERVER (Server Component, Route
// Handler, Server Action) yang terikat sesi user lewat cookie. Client inilah yang
// dioper ke lib/tiktok/sync.js supaya RLS (can_access_account) berlaku sesuai role.
//
// Pakai @supabase/ssr agar sesi auth tersimpan/terbaca dari cookie request.
// Modul ESM (dipakai runtime Next.js server; next/headers hanya ada di server).

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Fungsi: createSupabaseServerClient
// Bikin instance client Supabase server-side untuk request saat ini.
// Input: - (baca cookie dari next/headers). Output (async): SupabaseClient.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Dipanggil dari Server Component (cookie read-only) — abaikan; refresh
            // sesi ditangani oleh middleware.
          }
        },
      },
    },
  );
}
