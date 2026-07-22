// File: app/dashboard/actions.js
// Server Action untuk set target/goal cabang (blueprint 21A) & anotasi. Hanya
// admin/manager untuk target; anotasi oleh siapa pun yang punya akses cabang.
// Akses menggantikan RLS: dicek via lib/access.

"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db";
import { getCurrentProfile, canWrite } from "@/lib/auth";
import { assertCanAccess, canAccessAccount, isAdmin } from "@/lib/access";
import { logActivity } from "@/lib/audit";

// Parse angka bulat dari form (buang non-digit); kosong -> null.
function toInt(v) {
  const s = String(v ?? "").replace(/[^\d-]/g, "");
  if (s === "" || s === "-") return null;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}
function toNum(v) {
  const s = String(v ?? "").replace(",", ".").replace(/[^\d.-]/g, "");
  if (s === "") return null;
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

export async function setGoals(formData) {
  const profile = await getCurrentProfile();
  if (!canWrite(profile)) throw new Error("Hanya admin/manager yang boleh mengatur target.");
  const accountId = String(formData.get("accountId") || "");
  if (!accountId) return;
  await assertCanAccess(profile, accountId);

  // Target legacy dari dashboard: platform tiktok, bulan berjalan.
  const platform = "tiktok";
  const targetMonth = new Date().toISOString().slice(0, 7);
  const base = {
    targetTotalViews: toInt(formData.get("target_total_views")),
    targetEngagementRate: toNum(formData.get("target_engagement_rate")),
    targetNetFollowers: toInt(formData.get("target_net_followers")),
    updatedById: profile.id,
  };
  await prisma.tiktokAccountGoal.upsert({
    where: { tiktokAccountId_platform_targetMonth: { tiktokAccountId: accountId, platform, targetMonth } },
    create: { tiktokAccountId: accountId, platform, targetMonth, ...base },
    update: base,
  });
  await logActivity({ action: "set_target_cabang", entity: accountId });
  revalidatePath("/dashboard");
}

// Tambah anotasi/catatan pada tanggal tertentu (semua role dengan akses cabang).
export async function addAnnotation(formData) {
  const profile = await getCurrentProfile();
  if (!profile?.role) throw new Error("Belum login.");
  const accountId = String(formData.get("accountId") || "");
  const note_date = String(formData.get("note_date") || "");
  const note = String(formData.get("note") || "").trim();
  if (!accountId || !note_date || !note) return;
  await assertCanAccess(profile, accountId);
  await prisma.branchAnnotation.create({
    data: {
      tiktokAccountId: accountId,
      noteDate: new Date(note_date),
      note,
      createdById: profile.id,
      createdByEmail: profile.email,
    },
  });
  await logActivity({ action: "tambah_anotasi", entity: accountId, detail: { note_date } });
  revalidatePath("/dashboard");
}

// Hapus anotasi (pemilik atau admin, dan punya akses cabang).
export async function deleteAnnotation(formData) {
  const profile = await getCurrentProfile();
  if (!profile?.role) throw new Error("Belum login.");
  const id = String(formData.get("id") || "");
  if (!id) return;
  let key;
  try {
    key = BigInt(id);
  } catch {
    return;
  }
  const row = await prisma.branchAnnotation.findUnique({
    where: { id: key },
    select: { createdById: true, tiktokAccountId: true },
  });
  if (!row) return;
  const allowed = (await canAccessAccount(profile, row.tiktokAccountId)) &&
    (isAdmin(profile) || row.createdById === profile.id);
  if (!allowed) throw new Error("Tidak boleh menghapus anotasi ini.");
  await prisma.branchAnnotation.delete({ where: { id: key } });
  revalidatePath("/dashboard");
}
