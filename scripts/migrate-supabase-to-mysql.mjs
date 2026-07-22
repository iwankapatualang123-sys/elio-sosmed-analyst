// File: scripts/migrate-supabase-to-mysql.mjs
// Pindahkan data dari Supabase (Postgres, sumber) ke MySQL self-host (Prisma, tujuan).
// Dijalankan SEKALI saat cutover. Idempotent: pakai upsert per baris, aman diulang.
//
// Env yang dibutuhkan (set di shell / .env saat menjalankan):
//   SRC_SUPABASE_URL           = https://<ref>.supabase.co   (sumber)
//   SRC_SUPABASE_SERVICE_KEY   = service_role key sumber      (bypass RLS, baca semua)
//   DATABASE_URL               = mysql://user:pass@host:3306/elio_sosmed  (tujuan)
//
// Opsional — pindahkan password login supaya user tak perlu reset:
//   Export dulu dari Supabase (SQL editor):
//     select json_agg(json_build_object('id',id,'email',email,
//            'encrypted_password',encrypted_password)) from auth.users;
//   Simpan hasilnya ke file auth_users.json di folder kerja. Skrip akan mengisi
//   password_hash dari situ (hash bcrypt Supabase kompatibel dengan bcryptjs).
//
// Jalankan:
//   node scripts/migrate-supabase-to-mysql.mjs

import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const SRC_URL = process.env.SRC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SRC_KEY = process.env.SRC_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SRC_URL || !SRC_KEY) {
  console.error("❌ Set SRC_SUPABASE_URL + SRC_SUPABASE_SERVICE_KEY (sumber Supabase).");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("❌ Set DATABASE_URL (tujuan MySQL).");
  process.exit(1);
}

const supa = createClient(SRC_URL, SRC_KEY, { auth: { persistSession: false } });
const prisma = new PrismaClient();

// snake_case → camelCase, dengan override untuk kolom relasi yang di skema
// Prisma diberi akhiran "Id".
const OVERRIDES = {
  created_by: "createdById",
  updated_by: "updatedById",
  assigned_by: "assignedById",
  replaced_by_id: "replacedById",
};
const toCamel = (k) =>
  OVERRIDES[k] ?? k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

const isDateStr = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}([ T]|$)/.test(v);

function mapRow(row, { bigIntId, bigIntFields = [], jsonFields = [] }) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const key = toCamel(k);
    if (v === null || v === undefined) {
      out[key] = null;
    } else if (jsonFields.includes(k)) {
      out[key] = v; // Json — biarkan apa adanya
    } else if (isDateStr(v)) {
      out[key] = new Date(v);
    } else {
      out[key] = v;
    }
  }
  if (bigIntId && out.id != null) out.id = BigInt(out.id);
  for (const bf of bigIntFields) {
    const key = toCamel(bf);
    if (out[key] != null) out[key] = BigInt(out[key]);
  }
  return out;
}

// Ambil semua baris tabel Supabase dengan paginasi.
async function fetchAll(table) {
  const rows = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supa.from(table).select("*").range(from, from + page - 1);
    if (error) throw new Error(`baca ${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < page) break;
  }
  return rows;
}

// Konfigurasi tabel — URUT AMAN-FK (induk dulu). delegate = nama model Prisma.
const TABLES = [
  { table: "profiles", delegate: "profile", pk: "id" },
  { table: "tiktok_accounts", delegate: "tiktokAccount", pk: "id" },
  { table: "user_branch_access", delegate: "userBranchAccess", pk: "id" },
  { table: "tiktok_content", delegate: "tiktokContent", pk: "id" },
  { table: "tiktok_daily_overview", delegate: "tiktokDailyOverview", pk: "id" },
  { table: "tiktok_follower_history", delegate: "tiktokFollowerHistory", pk: "id" },
  { table: "tiktok_follower_gender", delegate: "tiktokFollowerGender", pk: "id" },
  { table: "tiktok_follower_territories", delegate: "tiktokFollowerTerritory", pk: "id" },
  { table: "tiktok_follower_activity", delegate: "tiktokFollowerActivity", pk: "id" },
  { table: "tiktok_viewers", delegate: "tiktokViewer", pk: "id" },
  { table: "activity_log", delegate: "activityLog", pk: "id", bigIntId: true },
  { table: "content_plan_categories", delegate: "contentPlanCategory", pk: "id", bigIntId: true },
  { table: "branch_annotations", delegate: "branchAnnotation", pk: "id", bigIntId: true },
  {
    table: "content_plans",
    delegate: "contentPlan",
    pk: "id",
    bigIntId: true,
    bigIntFields: ["replaced_by_id"],
    jsonFields: ["platforms", "platform_links"],
  },
  { table: "social_account_snapshots", delegate: "socialAccountSnapshot", pk: "id", bigIntId: true },
  { table: "instagram_daily_metrics", delegate: "instagramDailyMetric", pk: "id", bigIntId: true },
  { table: "instagram_content", delegate: "instagramContent", pk: "id", bigIntId: true },
  {
    table: "tiktok_account_goals",
    delegate: "tiktokAccountGoal",
    pk: ["tiktokAccountId", "platform", "targetMonth"], // PK komposit
  },
];

function whereFor(cfg, data) {
  if (Array.isArray(cfg.pk)) {
    return { tiktokAccountId_platform_targetMonth: {
      tiktokAccountId: data.tiktokAccountId, platform: data.platform, targetMonth: data.targetMonth,
    } };
  }
  return { id: data.id };
}

async function migrateTable(cfg) {
  const rows = await fetchAll(cfg.table);
  const delegate = prisma[cfg.delegate];
  let ok = 0;
  for (const raw of rows) {
    const data = mapRow(raw, cfg);
    // content_plans.replaced_by_id → tunda (bisa mengacu baris yang belum masuk).
    const deferred = cfg.table === "content_plans" ? data.replacedById : undefined;
    if (cfg.table === "content_plans") data.replacedById = null;
    await delegate.upsert({ where: whereFor(cfg, data), update: data, create: data });
    if (deferred != null) cfg._defer ??= [], cfg._defer.push({ id: data.id, replacedById: deferred });
    ok++;
  }
  // Pass kedua untuk self-FK content_plans.
  if (cfg._defer?.length) {
    for (const d of cfg._defer) {
      await delegate.update({ where: { id: d.id }, data: { replacedById: d.replacedById } });
    }
  }
  console.log(`  ✓ ${cfg.table.padEnd(28)} ${ok} baris`);
  return ok;
}

async function applyPasswords() {
  if (!existsSync("auth_users.json")) {
    console.log("  ⓘ auth_users.json tidak ada — lewati migrasi password (user perlu reset manual).");
    return;
  }
  const users = JSON.parse(readFileSync("auth_users.json", "utf8"));
  let n = 0;
  for (const u of users) {
    if (!u.encrypted_password) continue;
    try {
      await prisma.profile.update({
        where: { id: u.id },
        data: { passwordHash: u.encrypted_password },
      });
      n++;
    } catch {
      // profil belum ada / id tak cocok — abaikan
    }
  }
  console.log(`  ✓ password login diisi untuk ${n} user`);
}

async function main() {
  console.log("→ Migrasi Supabase → MySQL dimulai\n");
  let total = 0;
  for (const cfg of TABLES) total += await migrateTable(cfg);
  console.log("\n→ Mengisi password login (bcrypt dari auth.users)…");
  await applyPasswords();
  console.log(`\n✅ Selesai. Total ${total} baris data dipindahkan.`);
}

main()
  .catch((e) => {
    console.error("\n❌ Gagal:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
