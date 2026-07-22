// File: lib/auth.js
// Helper auth sisi server: ambil profil (role) user yang sedang login dari sesi
// JWT cookie (pengganti Supabase Auth). Dipakai Server Component / Route Handler
// / Server Action untuk gating akses.

import { cookies } from "next/headers";
import prisma from "./db";
import { SESSION_COOKIE, verifySession } from "./auth-jwt";
import { canWrite } from "./access";

// Fungsi: getSessionPayload — payload JWT terverifikasi { sub, email, role } / null.
export async function getSessionPayload() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return verifySession(token);
}

// Fungsi: getCurrentProfile
// Ambil profil lengkap user yang sedang login. Output (async): objek profil
// { id, full_name, email, role, is_active, ... } atau null. Mengembalikan null
// juga bila akun sudah dinonaktifkan.
export async function getCurrentProfile() {
  const payload = await getSessionPayload();
  if (!payload?.sub) return null;
  const profile = await prisma.profile.findUnique({ where: { id: payload.sub } });
  if (!profile || profile.isActive === false) return null;
  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.fullName,
    role: profile.role,
    is_active: profile.isActive,
    created_at: profile.createdAt,
    created_by: profile.createdById,
  };
}

// Re-export supaya import lama `{ canWrite } from "@/lib/auth"` tetap jalan.
export { canWrite };
