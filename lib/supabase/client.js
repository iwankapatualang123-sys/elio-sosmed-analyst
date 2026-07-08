// File: lib/supabase/client.js
// Tujuan: membuat client Supabase untuk sisi BROWSER (Client Component) — dipakai
// untuk login, baca data dengan sesi user, realtime, dll. Aman memakai publishable
// /anon key di sini karena akses tetap dibatasi RLS.
// Modul ESM (dipakai di komponen client Next.js).

import { createBrowserClient } from '@supabase/ssr';

// Fungsi: createSupabaseBrowserClient
// Bikin instance client Supabase untuk browser. Input: -. Output: SupabaseClient.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
