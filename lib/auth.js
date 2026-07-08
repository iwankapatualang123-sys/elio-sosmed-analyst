// File: lib/auth.js
// Helper auth sisi server: ambil user & profil (role) yang sedang login.
// Dipakai Server Component / Route Handler untuk gating akses.

import { createSupabaseServerClient } from "./supabase/server";

// Fungsi: getCurrentProfile
// Ambil profil (termasuk role) user yang sedang login, gabung dengan email dari auth.
// Output (async): objek profil { id, full_name, email, role, is_active, ... } atau null.
export async function getCurrentProfile() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  return { id: user.id, email: user.email, ...(profile || {}) };
}

// Fungsi: canWrite
// True kalau role boleh INSERT/UPDATE data (admin atau manager) — cocokkan dengan
// kebijakan RLS can_access_account (blueprint bagian 13).
export function canWrite(profile) {
  return !!profile && (profile.role === "admin" || profile.role === "manager");
}
