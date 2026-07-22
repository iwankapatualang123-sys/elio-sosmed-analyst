// File: scripts/gen-supabase-keys.mjs
// Generator kunci untuk SELF-HOST Supabase (Jalur A, lihat docs/DEPLOY_AAPANEL.md).
// Membuat JWT_SECRET acak + ANON_KEY + SERVICE_ROLE_KEY (JWT HS256 dgn klaim yang
// diharapkan Supabase). Tanpa dependensi npm — cukup Node.
//
// Jalankan DI MESIN ANDA (bukan diumbar), lalu tempel hasilnya ke
// supabase/docker/.env :
//   node scripts/gen-supabase-keys.mjs
//
// Opsi: masa berlaku token (default 10 tahun) & secret sendiri:
//   node scripts/gen-supabase-keys.mjs --years 10
//   JWT_SECRET=xxxx node scripts/gen-supabase-keys.mjs   (pakai secret yg sudah ada)

import crypto from "node:crypto";

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function signJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encHeader = b64url(JSON.stringify(header));
  const encPayload = b64url(JSON.stringify(payload));
  const data = `${encHeader}.${encPayload}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest();
  return `${data}.${b64url(sig)}`;
}

const args = process.argv.slice(2);
const years = Number(args[args.indexOf("--years") + 1]) || 10;

// Secret: dari env kalau ada, else acak 48 byte (base64).
const jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(48).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 48);

const iat = Math.floor(Date.now() / 1000);
const exp = iat + Math.round(years * 365.25 * 24 * 60 * 60);

const anonKey = signJwt({ role: "anon", iss: "supabase", iat, exp }, jwtSecret);
const serviceKey = signJwt({ role: "service_role", iss: "supabase", iat, exp }, jwtSecret);

// Password acak yang enak dipakai (tanpa karakter ambigu) untuk Postgres/Dashboard.
const pw = () => crypto.randomBytes(24).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 24);

console.log(`
# ── Tempel ke supabase/docker/.env (Supabase self-host) ──────────────────────
JWT_SECRET=${jwtSecret}
ANON_KEY=${anonKey}
SERVICE_ROLE_KEY=${serviceKey}

POSTGRES_PASSWORD=${pw()}
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=${pw()}

# Sesuaikan domain Anda:
# SITE_URL=https://app.domain-anda.com
# API_EXTERNAL_URL=https://db.domain-anda.com
# SUPABASE_PUBLIC_URL=https://db.domain-anda.com

# ── Tempel ke .env.local aplikasi (elio-sosmed-analyst) ──────────────────────
# NEXT_PUBLIC_SUPABASE_URL=https://db.domain-anda.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}
SUPABASE_SERVICE_ROLE_KEY=${serviceKey}

# Berlaku s/d: ${new Date(exp * 1000).toISOString().slice(0, 10)} (${years} tahun)
`.trim());
