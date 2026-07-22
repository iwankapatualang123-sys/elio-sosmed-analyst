// File: lib/auth-edge.js
// Sesi JWT HS256 — versi EDGE-SAFE (pakai Web Crypto, bukan node:crypto) supaya
// bisa dipakai di middleware/proxy Next.js (Edge runtime) sekaligus di route
// handler Node. Tidak mengimpor bcrypt/prisma. Secret dari env AUTH_JWT_SECRET.

const COOKIE = "elio_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 hari
const encoder = new TextEncoder();

function secret() {
  const s = process.env.AUTH_JWT_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_JWT_SECRET belum diset (≥16 char).");
  return s;
}

function b64url(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const b64urlStr = (str) => b64url(encoder.encode(str));
function fromB64url(str) {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}
async function hmacKey() {
  return crypto.subtle.importKey("raw", encoder.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

// Fungsi: signSession — buat JWT sesi untuk { sub, email, role }.
export async function signSession(payload) {
  const iat = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat, exp: iat + MAX_AGE };
  const data = `${b64urlStr(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64urlStr(JSON.stringify(body))}`;
  const key = await hmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return `${data}.${b64url(sig)}`;
}

// Fungsi: verifySession — validasi tanda tangan + kadaluarsa; balikan payload / null.
export async function verifySession(token) {
  try {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    const key = await hmacKey();
    const ok = await crypto.subtle.verify("HMAC", key, fromB64url(s), encoder.encode(`${h}.${p}`));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(p)));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = COOKIE;
export const SESSION_MAX_AGE = MAX_AGE;

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  };
}
