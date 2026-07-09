// File: lib/supabase/admin.js
// Tujuan: client Supabase dengan SERVICE ROLE key (bypass RLS sepenuhnya) — HANYA
// untuk aksi administratif sisi server (mis. membuat akun user baru lewat Admin
// API). JANGAN PERNAH import file ini dari komponen client atau kirim key ini ke
// browser. Modul ESM (server-only; dipanggil dari Server Action).

import { createClient } from "@supabase/supabase-js";

// Fungsi: createSupabaseAdminClient
// Bikin instance client Supabase dengan hak akses penuh (service_role).
// Melempar Error kalau SUPABASE_SERVICE_ROLE_KEY belum diset di env server.
// Input: -. Output: SupabaseClient (admin, tanpa sesi user).
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY belum diset — tambahkan di .env.local (lihat .env.local.example).");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
