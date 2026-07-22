// File: lib/tiktok/db-client.js
// Micro-client kompatibel-Supabase di atas Prisma/MySQL — HANYA subset yang
// dipakai lib/tiktok/sync.js: from(table).select(cols).eq().in() dan
// from(table).upsert(rows, { onConflict }). Dengan ini sync.js + upload.js (dan
// test-nya) tidak perlu diubah saat pindah dari Supabase ke MySQL.
//
// Kolom & nama tabel memakai snake_case yang sama dengan Supabase (kolom MySQL
// juga snake_case via @map), jadi pakai SQL mentah biar tak perlu memetakan nama.
// Server-only. Aman dari SQL-injection selama nama tabel/kolom berasal dari
// TABLE_CONFIG internal (bukan input user); nilai selalu lewat parameter.

import prisma from "../db.js";

// Whitelist tabel yang boleh disentuh jalur sync (jaga-jaga).
const ALLOWED = new Set([
  "tiktok_content",
  "tiktok_daily_overview",
  "tiktok_follower_history",
  "tiktok_follower_gender",
  "tiktok_follower_territories",
  "tiktok_follower_activity",
  "tiktok_viewers",
]);

const ident = (s) => "`" + String(s).replace(/`/g, "") + "`";

async function runSelect(db, table, eqs, inCol, inVals) {
  try {
    const cols = "*";
    const whereParts = [];
    const params = [];
    for (const [c, v] of Object.entries(eqs)) {
      whereParts.push(`${ident(c)} = ?`);
      params.push(v);
    }
    if (!inVals.length) return { data: [], error: null };
    whereParts.push(`${ident(inCol)} IN (${inVals.map(() => "?").join(",")})`);
    params.push(...inVals);
    const sql = `SELECT ${cols} FROM ${ident(table)}` +
      (whereParts.length ? ` WHERE ${whereParts.join(" AND ")}` : "");
    const rows = await db.$queryRawUnsafe(sql, ...params);
    return { data: rows, error: null };
  } catch (err) {
    return { data: null, error: { message: err?.message || String(err) } };
  }
}

async function runUpsert(db, table, rows, opts) {
  try {
    if (!ALLOWED.has(table)) throw new Error(`tabel ${table} tidak diizinkan`);
    if (!rows || rows.length === 0) return { error: null };
    const conflict = String(opts?.onConflict || "").split(",").map((s) => s.trim()).filter(Boolean);
    const cols = Object.keys(rows[0]);
    const placeholders = rows.map(() => `(${cols.map(() => "?").join(",")})`).join(",");
    const params = [];
    for (const r of rows) for (const c of cols) params.push(r[c] === undefined ? null : r[c]);
    // Update semua kolom kecuali kolom konflik (kunci unik).
    const updateCols = cols.filter((c) => !conflict.includes(c));
    const updateSet = (updateCols.length ? updateCols : cols)
      .map((c) => `${ident(c)} = VALUES(${ident(c)})`).join(", ");
    const sql =
      `INSERT INTO ${ident(table)} (${cols.map(ident).join(",")}) VALUES ${placeholders} ` +
      `ON DUPLICATE KEY UPDATE ${updateSet}`;
    await db.$executeRawUnsafe(sql, ...params);
    return { error: null };
  } catch (err) {
    return { error: { message: err?.message || String(err) } };
  }
}

// Fungsi: makeSyncDbClient
// Kembalikan objek dengan .from(table) yang meniru query-builder Supabase seperlunya.
export function makeSyncDbClient(db = prisma) {
  function from(table) {
    const eqs = {};
    const builder = {
      select() { return builder; },
      eq(col, val) { eqs[col] = val; return builder; },
      in(col, vals) { return runSelect(db, table, eqs, col, vals); },
      upsert(rows, opts) { return runUpsert(db, table, rows, opts); },
    };
    return builder;
  }
  return { from };
}

export default makeSyncDbClient;
