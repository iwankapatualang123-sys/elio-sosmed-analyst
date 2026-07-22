// File: app/content-plan/actions.js
// Server Actions untuk Rencana Konten (Content Plan). CRUD baris rencana per cabang.
// Otorisasi (akses cabang + owner/admin/manager) ditegakkan di kode via lib/access
// (menggantikan RLS). Status Uploaded/WIP dihitung saat baca (lib/tiktok/content-plan).

"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db";
import { getCurrentProfile, canWrite } from "@/lib/auth";
import { assertCanAccess, canAccessAccount, isAdmin } from "@/lib/access";
import { logActivity } from "@/lib/audit";
import { PLATFORM_KEYS } from "@/lib/tiktok/content-plan";

// Ambil string rapi dari FormData; kosong -> null.
function str(formData, key) {
  const v = String(formData.get(key) ?? "").trim();
  return v === "" ? null : v;
}
// Tanggal 'YYYY-MM-DD' valid, selain itu null.
function dateOrNull(v) {
  const s = String(v ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
// Awal bulan ('YYYY-MM-01') dari sebuah tanggal, untuk kolom plan_month (grouping).
function monthFirstDay(dateStr) {
  const d = dateOrNull(dateStr);
  return d ? `${d.slice(0, 7)}-01` : null;
}
function toIntOrNull(v) {
  const s = String(v ?? "").replace(/[^\d]/g, "");
  if (s === "") return null;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}
// id (string) -> BigInt; invalid -> null.
function bid(v) {
  try {
    return BigInt(String(v));
  } catch {
    return null;
  }
}
// Kolom snake (dari planFields / plan-import) -> data Prisma (camelCase + Date).
function planData(f) {
  return {
    planMonth: new Date(f.plan_month || `${new Date().toISOString().slice(0, 7)}-01`),
    postDate: f.post_date ? new Date(f.post_date) : null,
    platforms: f.platforms ?? ["tiktok"],
    platformLinks: f.platform_links ?? {},
    seq: f.seq ?? null,
    pic: f.pic ?? null,
    headline: f.headline ?? null,
    topic: f.topic ?? null,
    goalsContent: f.goals_content ?? null,
    primaryPillar: f.primary_pillar ?? null,
    secondaryPillar: f.secondary_pillar ?? null,
    contentType: f.content_type ?? null,
    referenceUrl: f.reference_url ?? null,
    postedUrl: f.posted_url ?? null,
    notes: f.notes ?? null,
    accToPosting: !!f.acc_to_posting,
    statusOverride: f.status_override ?? null,
  };
}

// Ambil rencana untuk cek izin.
async function getPlanMeta(id) {
  const key = bid(id);
  if (key == null) return null;
  return prisma.contentPlan.findUnique({
    where: { id: key },
    select: { id: true, createdById: true, tiktokAccountId: true, platformLinks: true },
  });
}
// Izin ubah: punya akses cabang DAN (admin/manager ATAU pemilik).
async function assertCanEditPlan(profile, plan) {
  if (!plan) throw new Error("Rencana tidak ditemukan.");
  const ok = (await canAccessAccount(profile, plan.tiktokAccountId)) &&
    (canWrite(profile) || plan.createdById === profile.id);
  if (!ok) { const e = new Error("Tidak boleh mengubah rencana ini."); e.status = 403; throw e; }
}
// Izin hapus: punya akses cabang DAN (admin ATAU pemilik).
async function assertCanDeletePlan(profile, plan) {
  if (!plan) throw new Error("Rencana tidak ditemukan.");
  const ok = (await canAccessAccount(profile, plan.tiktokAccountId)) &&
    (isAdmin(profile) || plan.createdById === profile.id);
  if (!ok) { const e = new Error("Tidak boleh menghapus rencana ini."); e.status = 403; throw e; }
}

// Kumpulkan field baris dari FormData jadi objek kolom (snake, lalu dipetakan planData).
function planFields(formData) {
  const post_date = dateOrNull(formData.get("post_date"));
  const explicitMonth = String(formData.get("plan_month") || "").trim(); // 'YYYY-MM'
  const plan_month =
    monthFirstDay(post_date) ||
    (/^\d{4}-\d{2}$/.test(explicitMonth) ? `${explicitMonth}-01` : null) ||
    `${new Date().toISOString().slice(0, 7)}-01`;

  const platforms = formData.getAll("platforms").map(String).filter((p) => PLATFORM_KEYS.includes(p));
  const platform_links = {};
  for (const p of PLATFORM_KEYS) {
    if (p === "tiktok") continue;
    const url = str(formData, `link_${p}`);
    if (url) platform_links[p] = url;
  }

  return {
    plan_month,
    post_date,
    platforms: platforms.length ? platforms : ["tiktok"],
    platform_links,
    seq: toIntOrNull(formData.get("seq")),
    pic: str(formData, "pic"),
    headline: str(formData, "headline"),
    topic: str(formData, "topic"),
    goals_content: str(formData, "goals_content"),
    primary_pillar: str(formData, "primary_pillar"),
    secondary_pillar: str(formData, "secondary_pillar"),
    content_type: str(formData, "content_type"),
    reference_url: str(formData, "reference_url"),
    posted_url: str(formData, "posted_url"),
    notes: str(formData, "notes"),
    acc_to_posting: String(formData.get("acc_to_posting") || "") === "on" || String(formData.get("acc_to_posting") || "") === "true",
    status_override: str(formData, "status_override"),
  };
}

// Buat baris rencana baru.
export async function createPlan(formData) {
  const profile = await getCurrentProfile();
  if (!profile?.role) throw new Error("Belum login.");
  const accountId = String(formData.get("accountId") || "");
  if (!accountId) throw new Error("Cabang wajib dipilih.");
  await assertCanAccess(profile, accountId);

  const fields = planFields(formData);
  try {
    await prisma.contentPlan.create({
      data: {
        tiktokAccountId: accountId,
        ...planData(fields),
        createdById: profile.id,
        createdByEmail: profile.email,
      },
    });
  } catch (err) {
    throw new Error(`Gagal menyimpan rencana: ${err?.message || err}`);
  }
  await logActivity({ action: "tambah_rencana_konten", entity: accountId, detail: { headline: fields.headline } });
  revalidatePath("/content-plan");
}

// Perbarui baris rencana (pemilik atau admin/manager, dan punya akses cabang).
export async function updatePlan(formData) {
  const profile = await getCurrentProfile();
  if (!profile?.role) throw new Error("Belum login.");
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("ID rencana tidak ada.");
  const plan = await getPlanMeta(id);
  await assertCanEditPlan(profile, plan);

  const fields = planFields(formData);
  const patch = planData(fields);
  // Pindah cabang: kalau accountId dikirim, pastikan boleh menaruh di cabang tujuan.
  const accountId = String(formData.get("accountId") || "").trim();
  if (accountId) {
    await assertCanAccess(profile, accountId);
    patch.tiktokAccountId = accountId;
  }
  try {
    await prisma.contentPlan.update({ where: { id: plan.id }, data: patch });
  } catch (err) {
    throw new Error(`Gagal memperbarui rencana: ${err?.message || err}`);
  }
  await logActivity({ action: "ubah_rencana_konten", entity: id, detail: accountId ? { moved_to: accountId } : undefined });
  revalidatePath("/content-plan");
}

// Hapus baris rencana (pemilik atau admin).
export async function deletePlan(formData) {
  const profile = await getCurrentProfile();
  if (!profile?.role) throw new Error("Belum login.");
  const id = String(formData.get("id") || "");
  if (!id) return;
  const plan = await getPlanMeta(id);
  if (!plan) return;
  await assertCanDeletePlan(profile, plan);
  await prisma.contentPlan.delete({ where: { id: plan.id } });
  await logActivity({ action: "hapus_rencana_konten", entity: id });
  revalidatePath("/content-plan");
}

// GANTI RENCANA: tandai rencana lama 'Replaced' + tautkan ke penggantinya.
export async function replacePlan(formData) {
  const profile = await getCurrentProfile();
  if (!profile?.role) throw new Error("Belum login.");
  const oldId = String(formData.get("oldId") || "");
  if (!oldId) throw new Error("Rencana yang diganti tidak ada.");
  const oldPlan = await getPlanMeta(oldId);
  await assertCanEditPlan(profile, oldPlan);
  const mode = String(formData.get("mode") || "new");

  let newId = null;
  if (mode === "existing") {
    newId = bid(formData.get("newId"));
    if (!newId) throw new Error("Pilih rencana pengganti dulu.");
    if (String(newId) === String(oldId)) throw new Error("Rencana pengganti tidak boleh sama dengan yang diganti.");
    const target = await getPlanMeta(String(newId));
    if (!target || !(await canAccessAccount(profile, target.tiktokAccountId))) {
      throw new Error("Rencana pengganti tidak ditemukan atau di luar akses Anda.");
    }
  } else {
    const accountId = String(formData.get("accountId") || "");
    if (!accountId) throw new Error("Cabang wajib dipilih.");
    await assertCanAccess(profile, accountId);
    const fields = planFields(formData);
    if (!fields.headline && !fields.post_date) throw new Error("Isi minimal Headline atau Tanggal untuk rencana pengganti.");
    let created;
    try {
      created = await prisma.contentPlan.create({
        data: { tiktokAccountId: accountId, ...planData(fields), createdById: profile.id, createdByEmail: profile.email },
        select: { id: true },
      });
    } catch (err) {
      throw new Error(`Gagal membuat rencana pengganti: ${err?.message || err}`);
    }
    newId = created.id;
  }

  try {
    await prisma.contentPlan.update({
      where: { id: oldPlan.id },
      data: { replacedById: newId, statusOverride: "Replaced" },
    });
  } catch (err) {
    throw new Error(`Gagal menandai rencana lama: ${err?.message || err}`);
  }
  await logActivity({ action: "ganti_rencana_konten", entity: oldId, detail: { mode, replaced_by: String(newId) } });
  revalidatePath("/content-plan");
  return { newId: typeof newId === "bigint" ? Number(newId) : newId };
}

// BATALKAN penggantian: lepas tautan replaced_by_id + status_override.
export async function unreplacePlan(formData) {
  const profile = await getCurrentProfile();
  if (!profile?.role) throw new Error("Belum login.");
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("ID rencana tidak ada.");
  const plan = await getPlanMeta(id);
  await assertCanEditPlan(profile, plan);
  await prisma.contentPlan.update({
    where: { id: plan.id },
    data: { replacedById: null, statusOverride: null },
  });
  await logActivity({ action: "batal_ganti_rencana_konten", entity: id });
  revalidatePath("/content-plan");
}

// Set cepat link konten tayang (posted_url) dari input inline di tabel.
export async function setPostedUrl(formData) {
  const profile = await getCurrentProfile();
  if (!profile?.role) throw new Error("Belum login.");
  const id = String(formData.get("id") || "");
  if (!id) return;
  const plan = await getPlanMeta(id);
  await assertCanEditPlan(profile, plan);
  const url = String(formData.get("posted_url") || "").trim() || null;
  await prisma.contentPlan.update({ where: { id: plan.id }, data: { postedUrl: url } });
  await logActivity({ action: "set_link_tayang_rencana", entity: id });
  revalidatePath("/content-plan");
  revalidatePath("/dashboard");
}

// Set cepat link tayang platform NON-TikTok (Instagram/Threads) dari input inline.
export async function setPlatformLink(formData) {
  const profile = await getCurrentProfile();
  if (!profile?.role) throw new Error("Belum login.");
  const id = String(formData.get("id") || "");
  const platform = String(formData.get("platform") || "");
  if (!id) return;
  if (platform === "tiktok") return setPostedUrl(formData); // TikTok tetap lewat posted_url
  if (!PLATFORM_KEYS.includes(platform)) throw new Error("Platform tidak dikenal.");

  const plan = await getPlanMeta(id);
  await assertCanEditPlan(profile, plan);
  const url = String(formData.get("posted_url") || "").trim();
  const links = { ...(plan.platformLinks || {}) };
  if (url) links[platform] = url; else delete links[platform];

  await prisma.contentPlan.update({ where: { id: plan.id }, data: { platformLinks: links } });
  await logActivity({ action: "set_link_tayang_rencana", entity: id, detail: { platform } });
  revalidatePath("/content-plan");
  revalidatePath("/dashboard");
}

// ————————————————————————————————————————————————————————————————
// IMPORT MASSAL dari Excel (.xlsx) dengan MAPPING per-Outlet -> cabang.
// ————————————————————————————————————————————————————————————————

function requireFile(formData) {
  const file = formData.get("file");
  if (!file || typeof file.arrayBuffer !== "function") throw new Error("File Excel tidak ditemukan.");
  return file;
}

// LANGKAH 1: analisa file untuk pratinjau (tidak menyimpan apa pun).
export async function analyzePlansExcel(formData) {
  const profile = await getCurrentProfile();
  if (!profile?.role) throw new Error("Belum login.");
  const file = requireFile(formData);
  const sheetName = String(formData.get("sheetName") || "").trim() || undefined;

  const { parsePlanWorkbook, summarizeOutlets } = await import("@/lib/tiktok/plan-import");
  const parsed = await parsePlanWorkbook(Buffer.from(await file.arrayBuffer()), { sheetName });
  return {
    sheetNames: parsed.sheetNames,
    sheetUsed: parsed.sheetUsed,
    totalRows: parsed.records.length,
    skippedEmpty: parsed.skippedEmpty,
    outlets: summarizeOutlets(parsed.records),
    sample: parsed.records.slice(0, 8).map((r) => ({ post_date: r.post_date, plan_month: r.plan_month, headline: r.headline, outlet: r.outlet })),
  };
}

// LANGKAH 2: impor dengan peta Outlet->cabang.
export async function importPlansExcelMapped(formData) {
  const profile = await getCurrentProfile();
  if (!profile?.role) throw new Error("Belum login.");
  const file = requireFile(formData);
  const sheetName = String(formData.get("sheetName") || "").trim() || undefined;
  let byOutlet = {};
  try {
    const m = JSON.parse(String(formData.get("mapping") || "{}"));
    byOutlet = m.byOutlet && typeof m.byOutlet === "object" ? m.byOutlet : {};
  } catch {
    throw new Error("Peta Outlet tidak valid.");
  }

  const { parsePlanWorkbook } = await import("@/lib/tiktok/plan-import");
  const { records, skippedEmpty } = await parsePlanWorkbook(Buffer.from(await file.arrayBuffer()), { sheetName });

  const byAcc = new Map();
  let skippedUnmapped = 0;
  for (const rec of records) {
    const acc = byOutlet[rec.outlet || ""];
    if (!acc) { skippedUnmapped += 1; continue; }
    if (!byAcc.has(acc)) byAcc.set(acc, []);
    byAcc.get(acc).push(rec);
  }
  const accIds = [...byAcc.keys()];
  if (accIds.length === 0) {
    return { inserted: 0, byBranch: [], skippedDup: 0, skippedEmpty, skippedUnmapped };
  }
  // Cek akses tiap cabang tujuan (menggantikan RLS WITH CHECK).
  for (const acc of accIds) await assertCanAccess(profile, acc);

  // Dedup per-cabang: ambil headline+tanggal yang sudah ada di cabang-cabang terlibat.
  const existing = await prisma.contentPlan.findMany({
    where: { tiktokAccountId: { in: accIds } },
    select: { tiktokAccountId: true, headline: true, postDate: true },
  });
  const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
  const seen = new Set(existing.map((r) => `${r.tiktokAccountId}|${(r.headline || "").toLowerCase().trim()}|${fmtDate(r.postDate)}`));

  let skippedDup = 0;
  const rows = [];
  const perBranch = new Map();
  for (const [acc, recs] of byAcc) {
    for (const rec of recs) {
      const key = `${acc}|${(rec.headline || "").toLowerCase().trim()}|${rec.post_date || ""}`;
      if (seen.has(key)) { skippedDup += 1; continue; }
      seen.add(key);
      rows.push({
        tiktokAccountId: acc,
        ...planData(rec),
        createdById: profile.id,
        createdByEmail: profile.email,
      });
      perBranch.set(acc, (perBranch.get(acc) || 0) + 1);
    }
  }

  let inserted = 0;
  if (rows.length > 0) {
    try {
      const res = await prisma.contentPlan.createMany({ data: rows });
      inserted = res.count ?? rows.length;
    } catch (err) {
      throw new Error(`Gagal menyimpan ${rows.length} baris: ${err?.message || err}`);
    }
    await logActivity({ action: "import_rencana_konten", entity: accIds.join(","), detail: { inserted, skippedDup, skippedEmpty, skippedUnmapped, branches: accIds.length } });
    revalidatePath("/content-plan");
  }

  return {
    inserted,
    byBranch: [...perBranch.entries()].map(([accountId, count]) => ({ accountId, count })),
    skippedDup,
    skippedEmpty,
    skippedUnmapped,
  };
}

// Toggle cepat ACC to POSTING (checkbox di tabel).
export async function toggleAcc(formData) {
  const profile = await getCurrentProfile();
  if (!profile?.role) throw new Error("Belum login.");
  const id = String(formData.get("id") || "");
  const next = String(formData.get("next") || "") === "true";
  if (!id) return;
  const plan = await getPlanMeta(id);
  await assertCanEditPlan(profile, plan);
  await prisma.contentPlan.update({ where: { id: plan.id }, data: { accToPosting: next } });
  revalidatePath("/content-plan");
}
