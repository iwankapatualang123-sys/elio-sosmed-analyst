// File: scripts/import-from-json.mjs
// Impor data ke MySQL (Prisma) dari SATU file JSON hasil ekspor Supabase.
// Dipakai untuk migrasi tanpa perlu key/koneksi Supabase di server — file JSON
// disiapkan terpisah (berisi { <tabel>: [...baris], _auth_users: [...] }).
// Idempotent: upsert per baris, aman diulang.
//
// Jalankan DI SERVER (DATABASE_URL dari .env):
//   node --env-file=.env scripts/import-from-json.mjs supabase-export.json

import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const file = process.argv[2] || "supabase-export.json";
let dump;
try {
  dump = JSON.parse(readFileSync(file, "utf8"));
} catch (e) {
  console.error(`❌ Gagal baca ${file}: ${e.message}`);
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL belum ada. Jalankan: node --env-file=.env scripts/import-from-json.mjs <file>");
  process.exit(1);
}

const prisma = new PrismaClient();

const OVERRIDES = {
  created_by: "createdById",
  updated_by: "updatedById",
  assigned_by: "assignedById",
  replaced_by_id: "replacedById",
};
const toCamel = (k) => OVERRIDES[k] ?? k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
const isDateStr = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}([ T]|$)/.test(v);

function mapRow(row, { bigIntId, bigIntFields = [], jsonFields = [] }) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const key = toCamel(k);
    if (v === null || v === undefined) out[key] = null;
    else if (jsonFields.includes(k)) out[key] = v;
    else if (isDateStr(v)) out[key] = new Date(v);
    else out[key] = v;
  }
  if (bigIntId && out.id != null) out.id = BigInt(out.id);
  for (const bf of bigIntFields) {
    const key = toCamel(bf);
    if (out[key] != null) out[key] = BigInt(out[key]);
  }
  return out;
}

// URUT AMAN-FK (induk dulu).
const TABLES = [
  { key: "profiles", delegate: "profile" },
  { key: "tiktok_accounts", delegate: "tiktokAccount" },
  { key: "user_branch_access", delegate: "userBranchAccess" },
  { key: "tiktok_content", delegate: "tiktokContent" },
  { key: "tiktok_daily_overview", delegate: "tiktokDailyOverview" },
  { key: "tiktok_follower_history", delegate: "tiktokFollowerHistory" },
  { key: "tiktok_follower_gender", delegate: "tiktokFollowerGender" },
  { key: "tiktok_follower_territories", delegate: "tiktokFollowerTerritory" },
  { key: "tiktok_follower_activity", delegate: "tiktokFollowerActivity" },
  { key: "tiktok_viewers", delegate: "tiktokViewer" },
  { key: "activity_log", delegate: "activityLog", bigIntId: true },
  { key: "content_plan_categories", delegate: "contentPlanCategory", bigIntId: true },
  { key: "branch_annotations", delegate: "branchAnnotation", bigIntId: true },
  { key: "content_plans", delegate: "contentPlan", bigIntId: true, bigIntFields: ["replaced_by_id"], jsonFields: ["platforms", "platform_links"] },
  { key: "social_account_snapshots", delegate: "socialAccountSnapshot", bigIntId: true },
  { key: "instagram_daily_metrics", delegate: "instagramDailyMetric", bigIntId: true },
  { key: "instagram_content", delegate: "instagramContent", bigIntId: true },
  { key: "tiktok_account_goals", delegate: "tiktokAccountGoal", composite: true },
];

function whereFor(cfg, data) {
  if (cfg.composite) {
    return { tiktokAccountId_platform_targetMonth: { tiktokAccountId: data.tiktokAccountId, platform: data.platform, targetMonth: data.targetMonth } };
  }
  return { id: data.id };
}

async function migrateTable(cfg) {
  const rows = dump[cfg.key] || [];
  const delegate = prisma[cfg.delegate];
  const deferred = [];
  let ok = 0;
  for (const raw of rows) {
    const data = mapRow(raw, cfg);
    if (cfg.key === "content_plans" && data.replacedById != null) {
      deferred.push({ id: data.id, replacedById: data.replacedById });
      data.replacedById = null;
    }
    await delegate.upsert({ where: whereFor(cfg, data), update: data, create: data });
    ok += 1;
  }
  for (const d of deferred) {
    await delegate.update({ where: { id: d.id }, data: { replacedById: d.replacedById } });
  }
  console.log(`  ✓ ${cfg.key.padEnd(28)} ${ok} baris`);
  return ok;
}

async function applyPasswords() {
  const users = dump._auth_users || [];
  let n = 0;
  for (const u of users) {
    if (!u.encrypted_password) continue;
    try {
      await prisma.profile.update({ where: { id: u.id }, data: { passwordHash: u.encrypted_password } });
      n += 1;
    } catch {
      // profil tak ada / id tak cocok — abaikan
    }
  }
  console.log(`  ✓ password login diisi untuk ${n} user`);
}

async function main() {
  console.log("→ Impor data (JSON) → MySQL dimulai\n");
  let total = 0;
  for (const cfg of TABLES) total += await migrateTable(cfg);
  console.log("\n→ Mengisi password login (bcrypt dari auth.users)…");
  await applyPasswords();
  console.log(`\n✅ Selesai. Total ${total} baris data diimpor.`);
}

main()
  .catch((e) => {
    console.error("\n❌ Gagal:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
