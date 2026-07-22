// File: lib/auth-jwt.js
// Auth custom pengganti Supabase Auth (GoTrue). Sesi disimpan di cookie httpOnly
// berisi JWT HS256 yang ditandatangani AUTH_JWT_SECRET. Password di-hash bcrypt —
// hash lama dari Supabase (auth.users, format $2a$/$2b$) tetap kompatibel, jadi
// user TIDAK perlu reset password setelah migrasi.
//
// Server-only. Dipakai oleh: rute /api/auth/*, proxy.js (middleware), lib/auth.js.

import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const COOKIE_NAME = "elio_session";
const MAX_AGE_S = 60 * 60 * 24 * 7; // 7 hari

function secret() {
  const s = process.env.AUTH_JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_JWT_SECRET belum diset (≥16 char) — lihat .env.example.");
  }
  return s;
}

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const b64urlJson = (obj) => b64url(JSON.stringify(obj));

function fromB64url(str) {
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

// Fungsi: signSession — buat JWT sesi untuk { sub, email, role }.
export function signSession(payload) {
  const iat = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat, exp: iat + MAX_AGE_S };
  const data = `${b64urlJson({ alg: "HS256", typ: "JWT" })}.${b64urlJson(body)}`;
  const sig = crypto.createHmac("sha256", secret()).update(data).digest();
  return `${data}.${b64url(sig)}`;
}

// Fungsi: verifySession — validasi tanda tangan + kadaluarsa, balikan payload / null.
export function verifySession(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const expected = crypto.createHmac("sha256", secret()).update(`${h}.${p}`).digest();
  const got = fromB64url(s);
  if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) return null;
  let payload;
  try {
    payload = JSON.parse(fromB64url(p).toString());
  } catch {
    return null;
  }
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

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

export const SESSION_COOKIE = COOKIE_NAME;
export const SESSION_MAX_AGE = MAX_AGE_S;

// Opsi cookie standar untuk set/clear sesi (dipakai route handler auth).
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S,
  };
}
