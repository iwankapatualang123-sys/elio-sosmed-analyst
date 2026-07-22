// File: scripts/gen-secret.mjs
// Cetak satu AUTH_JWT_SECRET acak (48 char) untuk .env.local. Tanpa dependensi.
//   node scripts/gen-secret.mjs
import crypto from "node:crypto";

const secret = crypto.randomBytes(48).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 48);
console.log(`AUTH_JWT_SECRET=${secret}`);
