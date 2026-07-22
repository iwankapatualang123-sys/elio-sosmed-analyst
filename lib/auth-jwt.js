// File: lib/auth-jwt.js
// Auth custom pengganti Supabase Auth (versi NODE — dipakai route handler & Server
// Component). Sesi JWT di-handle lib/auth-edge (Web Crypto, edge-safe); di sini
// tambahan password bcrypt (butuh Node). Hash lama dari Supabase (auth.users,
// $2a$/$2b$) tetap kompatibel, jadi user TIDAK perlu reset password setelah migrasi.

import bcrypt from "bcryptjs";

export {
  signSession,
  verifySession,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  sessionCookieOptions,
} from "./auth-edge.js";

// Fungsi: hashPassword / verifyPassword — bcrypt (kompatibel hash Supabase lama).
export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}
export async function verifyPassword(plain, hash) {
  if (!hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
