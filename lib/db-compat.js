// File: lib/db-compat.js
// Client BACA kompatibel-Supabase di atas Prisma/MySQL (SQL mentah), khusus untuk
// halaman & laporan. Mengembalikan baris snake_case (persis kolom MySQL) supaya
// kode hilir yang membaca kunci snake_case tidak perlu diubah.
//
// SEKALIGUS menegakkan kontrol akses (pengganti RLS): saat dibuat dengan sebuah
// profil, SELECT ke tabel ber-cabang otomatis difilter ke cabang yang boleh
// diakses user (admin = semua). Ini meniru can_access_account.
//
// Hanya mendukung subset yang dipakai kode baca: from().select().eq().in()
// .order().limit().single()/.maybeSingle(), dan await (thenable) -> {data,error}.
// TIDAK untuk tulis — operasi tulis pakai Prisma langsung + cek akses eksplisit.
// Server-only.

import prisma from "./db.js";
import { accessibleAccountIds } from "./access.js";

const ident = (s) => "`" + String(s).replace(/`/g, "") + "`";

// Kolom JSON & numeric-desimal — dinormalkan agar bentuknya sama seperti dulu
// dari Supabase (JSON: objek/array; desimal: number; bukan string/Decimal/BigInt).
const JSON_COLS = new Set(["platforms", "platform_links", "detail"]);
const NUMBER_COLS = new Set(["male_pct", "female_pct", "other_pct", "distribution_pct", "target_engagement_rate"]);

function normVal(key, v) {
  if (v === null || v === undefined) return v;
  if (typeof v === "bigint") return Number(v);
  if (v instanceof Date) {
    // DATE (tengah malam UTC) -> 'YYYY-MM-DD'; DATETIME lain -> ISO (seperti timestamptz).
    const iso = v.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso;
  }
  if (JSON_COLS.has(key)) {
    if (typeof v === "string") { try { return JSON.parse(v); } catch { return v; } }
    return v; // sudah objek/array
  }
  if (NUMBER_COLS.has(key)) return v == null ? v : Number(v);
  if (typeof v === "object" && typeof v.toNumber === "function") return v.toNumber(); // Prisma.Decimal
  return v;
}
function normRow(row) {
  const o = {};
  for (const k in row) o[k] = normVal(k, row[k]);
  return o;
}

// Peta scope akses per tabel.
//   account     : difilter kolom -> IN (cabang yang boleh diakses); admin = semua.
//   selfOrAdmin : non-admin -> kolom = id user sendiri; admin = semua.
const SCOPE = {
  tiktok_accounts: { col: "id", type: "account" },
  tiktok_content: { col: "tiktok_account_id", type: "account" },
  tiktok_daily_overview: { col: "tiktok_account_id", type: "account" },
  tiktok_follower_history: { col: "tiktok_account_id", type: "account" },
  tiktok_follower_gender: { col: "tiktok_account_id", type: "account" },
  tiktok_follower_territories: { col: "tiktok_account_id", type: "account" },
  tiktok_follower_activity: { col: "tiktok_account_id", type: "account" },
  tiktok_viewers: { col: "tiktok_account_id", type: "account" },
  tiktok_account_goals: { col: "tiktok_account_id", type: "account" },
  branch_annotations: { col: "tiktok_account_id", type: "account" },
  content_plans: { col: "tiktok_account_id", type: "account" },
  social_account_snapshots: { col: "tiktok_account_id", type: "account" },
  instagram_content: { col: "tiktok_account_id", type: "account" },
  instagram_daily_metrics: { col: "tiktok_account_id", type: "account" },
  profiles: { col: "id", type: "selfOrAdmin" },
  user_branch_access: { col: "user_id", type: "selfOrAdmin" },
  activity_log: { col: "user_id", type: "selfOrAdmin" },
  // content_plan_categories: tanpa scope (nilai dropdown, boleh dibaca semua).
};

function buildQuery(ctx, table) {
  const wheres = [];
  const params = [];
  let forceEmpty = false;

  // Terapkan scope akses.
  const scope = SCOPE[table];
  if (scope) {
    if (scope.type === "account") {
      if (ctx.accessible !== null) { // null = admin (tanpa batas)
        if (ctx.accessible.length === 0) forceEmpty = true;
        else {
          wheres.push(`${ident(scope.col)} IN (${ctx.accessible.map(() => "?").join(",")})`);
          params.push(...ctx.accessible);
        }
      }
    } else if (scope.type === "selfOrAdmin") {
      if (!ctx.isAdmin) {
        wheres.push(`${ident(scope.col)} = ?`);
        params.push(ctx.userId);
      }
    }
  }

  const orderCols = [];
  let limitN = null;
  let cols = "*";

  async function run(single) {
    if (forceEmpty) {
      if (single) return { data: null, error: single === "one" ? { message: "no rows" } : null };
      return { data: [], error: null };
    }
    try {
      const sql =
        `SELECT ${cols} FROM ${ident(table)}` +
        (wheres.length ? ` WHERE ${wheres.join(" AND ")}` : "") +
        (orderCols.length ? ` ORDER BY ${orderCols.join(", ")}` : "") +
        (limitN != null ? ` LIMIT ${Number(limitN)}` : (single ? " LIMIT 1" : ""));
      const rawRows = await prisma.$queryRawUnsafe(sql, ...params);
      const rows = rawRows.map(normRow);
      if (single) {
        const row = rows[0] ?? null;
        return { data: row, error: row || single === "maybe" ? null : { message: "no rows" } };
      }
      return { data: rows, error: null };
    } catch (err) {
      return { data: single ? null : null, error: { message: err?.message || String(err) } };
    }
  }

  const builder = {
    // cols: daftar kolom snake dipisah koma, atau "*" (tanpa embed relasi).
    select(c) { if (c && c.trim() && c.trim() !== "*") cols = c.split(",").map((x) => ident(x.trim())).join(", "); return builder; },
    eq(c, v) { wheres.push(`${ident(c)} = ?`); params.push(v); return builder; },
    in(c, vals) {
      if (!vals || vals.length === 0) forceEmpty = true;
      else { wheres.push(`${ident(c)} IN (${vals.map(() => "?").join(",")})`); params.push(...vals); }
      return builder;
    },
    order(c, opts) {
      const dir = opts && opts.ascending === false ? "DESC" : "ASC";
      // nullsFirst default MySQL: NULL dianggap terkecil (muncul dulu di ASC).
      orderCols.push(`${ident(c)} ${dir}`);
      return builder;
    },
    limit(n) { limitN = n; return builder; },
    single() { return run("one"); },
    maybeSingle() { return run("maybe"); },
    then(resolve, reject) { return run(null).then(resolve, reject); },
  };
  return builder;
}

// Fungsi: createReadClient
// Bangun client baca terikat profil (untuk scope akses). await sebelum dipakai.
export async function createReadClient(profile) {
  const accessible = profile ? await accessibleAccountIds(profile) : []; // null = admin
  const ctx = {
    accessible,
    isAdmin: !!profile && profile.role === "admin",
    userId: profile?.id || "__none__",
  };
  return { from: (table) => buildQuery(ctx, table) };
}

export default createReadClient;
