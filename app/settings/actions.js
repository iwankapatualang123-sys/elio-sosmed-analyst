// File: app/settings/actions.js
// Server Actions untuk manajemen cabang & user (khusus admin). Otorisasi admin
// ditegakkan di kode (getCurrentProfile), penyimpanan via Prisma. Pembuatan user
// & reset password kini memakai auth custom (bcrypt), bukan Supabase Auth.

"use server";

import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/db";
import { getCurrentProfile } from "@/lib/auth";
import { hashPassword } from "@/lib/auth-jwt";
import { logActivity } from "@/lib/audit";

// Fungsi: requireAdmin — pastikan pemanggil admin, kembalikan profilnya.
async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile?.id) throw new Error("Belum login.");
  if (profile.role !== "admin") throw new Error("Hanya admin.");
  return profile;
}

// id (string) -> BigInt; invalid -> null.
function bid(v) {
  try {
    return BigInt(String(v));
  } catch {
    return null;
  }
}

// Fungsi: addBranch — tambah cabang TikTok baru.
export async function addBranch(formData) {
  const profile = await requireAdmin();
  const nama_cabang = String(formData.get("nama_cabang") || "").trim();
  const tiktok_username = String(formData.get("tiktok_username") || "").trim().replace(/^@/, "").toLowerCase();
  const kategori = String(formData.get("kategori") || "").trim() || null;
  if (!nama_cabang || !tiktok_username) return;
  await prisma.tiktokAccount.create({
    data: { namaCabang: nama_cabang, tiktokUsername: tiktok_username, kategori, isActive: true, createdById: profile.id },
  });
  await logActivity({ action: "tambah_cabang", entity: nama_cabang, detail: { tiktok_username } });
  revalidatePath("/settings");
}

// Fungsi: toggleBranchActive — aktif/nonaktifkan cabang (arsip tanpa hapus data).
export async function toggleBranchActive(formData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const next = String(formData.get("next") || "") === "true";
  if (!id) return;
  await prisma.tiktokAccount.update({ where: { id }, data: { isActive: next } });
  await logActivity({ action: next ? "aktifkan_cabang" : "nonaktifkan_cabang", entity: id });
  revalidatePath("/settings");
}

// Fungsi: updateBranch — ubah nama/username/kategori cabang.
export async function updateBranch(formData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const nama_cabang = String(formData.get("nama_cabang") || "").trim();
  const tiktok_username = String(formData.get("tiktok_username") || "").trim().replace(/^@/, "").toLowerCase();
  const kategori = String(formData.get("kategori") || "").trim() || null;
  if (!id || !nama_cabang || !tiktok_username) throw new Error("Nama cabang dan username wajib diisi.");
  try {
    await prisma.tiktokAccount.update({ where: { id }, data: { namaCabang: nama_cabang, tiktokUsername: tiktok_username, kategori } });
  } catch (err) {
    throw new Error(`Gagal memperbarui cabang: ${err?.message || err}`);
  }
  await logActivity({ action: "ubah_cabang", entity: id, detail: { nama_cabang, tiktok_username } });
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/data");
  revalidatePath("/calendar");
  revalidatePath("/content-plan");
}

// Fungsi: deleteBranch — hapus PERMANEN cabang + semua data terkait (cascade FK).
export async function deleteBranch(formData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const confirmName = String(formData.get("confirmName") || "").trim();
  if (!id) return;

  const branch = await prisma.tiktokAccount.findUnique({ where: { id }, select: { namaCabang: true } });
  if (!branch) throw new Error("Cabang tidak ditemukan.");
  if (confirmName !== branch.namaCabang) {
    throw new Error("Nama konfirmasi tidak cocok — penghapusan dibatalkan.");
  }
  try {
    await prisma.tiktokAccount.delete({ where: { id } });
  } catch (err) {
    throw new Error(`Gagal menghapus cabang: ${err?.message || err}`);
  }
  await logActivity({ action: "hapus_cabang_permanen", entity: id, detail: { nama_cabang: branch.namaCabang } });
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/data");
  revalidatePath("/calendar");
  revalidatePath("/content-plan");
  revalidatePath("/upload");
}

// Fungsi: addCategory — tambah nilai baru ke kategori Rencana Konten.
export async function addCategory(formData) {
  const profile = await requireAdmin();
  const category_type = String(formData.get("category_type") || "");
  const value = String(formData.get("value") || "").trim();
  if (!["pic", "goals", "pillar", "type"].includes(category_type) || !value) return;
  try {
    await prisma.contentPlanCategory.create({ data: { categoryType: category_type, value, createdById: profile.id } });
  } catch (err) {
    // Duplikat (unique) diabaikan senyap; error lain dilempar.
    if (err?.code !== "P2002") throw new Error(`Gagal menambah kategori: ${err?.message || err}`);
  }
  await logActivity({ action: "tambah_kategori_rencana", entity: value, detail: { category_type } });
  revalidatePath("/settings");
  revalidatePath("/content-plan");
}

// Angka longgar -> int / num / null (target boleh dikosongkan).
function goalInt(v) {
  const s = String(v ?? "").replace(/[^\d]/g, "");
  return s === "" ? null : parseInt(s, 10);
}
function goalNum(v) {
  const s = String(v ?? "").replace(/[^\d.,]/g, "").replace(",", ".");
  if (s === "") return null;
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

// Fungsi: setAccountGoal — set target 1 cabang untuk 1 PLATFORM di 1 BULAN.
export async function setAccountGoal(formData) {
  const profile = await requireAdmin();
  const accountId = String(formData.get("accountId") || "");
  const platform = String(formData.get("platform") || "");
  const targetMonth = String(formData.get("target_month") || "");
  if (!accountId || !["tiktok", "instagram"].includes(platform)) return;
  if (!/^\d{4}-\d{2}$/.test(targetMonth)) throw new Error("Bulan target tidak valid.");
  const base = {
    targetTotalViews: goalInt(formData.get("target_total_views")),
    targetEngagementRate: goalNum(formData.get("target_engagement_rate")),
    targetNetFollowers: goalInt(formData.get("target_net_followers")),
    updatedById: profile.id,
  };
  try {
    await prisma.tiktokAccountGoal.upsert({
      where: { tiktokAccountId_platform_targetMonth: { tiktokAccountId: accountId, platform, targetMonth } },
      create: { tiktokAccountId: accountId, platform, targetMonth, ...base },
      update: base,
    });
  } catch (err) {
    throw new Error(`Gagal menyimpan target: ${err?.message || err}`);
  }
  await logActivity({ action: "set_target_cabang", entity: accountId, detail: { platform, month: targetMonth } });
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

// Fungsi: deleteCategory — hapus satu nilai kategori.
export async function deleteCategory(formData) {
  await requireAdmin();
  const key = bid(formData.get("id"));
  if (key == null) return;
  await prisma.contentPlanCategory.delete({ where: { id: key } }).catch(() => {});
  await logActivity({ action: "hapus_kategori_rencana", entity: String(formData.get("id") || "") });
  revalidatePath("/settings");
  revalidatePath("/content-plan");
}

// Fungsi: setUserRole — ubah role user (admin/manager/staff).
export async function setUserRole(formData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const role = String(formData.get("role") || "");
  if (!id || !["admin", "manager", "staff"].includes(role)) return;
  await prisma.profile.update({ where: { id }, data: { role } });
  await logActivity({ action: "ubah_role_user", entity: role, detail: { user_id: id } });
  revalidatePath("/settings");
}

// Fungsi: toggleUserActive — aktif/nonaktifkan user.
export async function toggleUserActive(formData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const next = String(formData.get("next") || "") === "true";
  if (!id) return;
  await prisma.profile.update({ where: { id }, data: { isActive: next } });
  await logActivity({ action: next ? "aktifkan_user" : "nonaktifkan_user", detail: { user_id: id } });
  revalidatePath("/settings");
}

// Alfabet TANPA karakter ambigu (tidak ada 0/O, 1/l/I) — password sementara sering
// dibagikan manual (WA/lisan) & diketik ulang, jadi salah baca/ketik diminimalkan.
const TEMP_PW_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

// Fungsi: generateTempPassword — password sementara acak (server-only, crypto-safe).
function generateTempPassword(length = 14) {
  let out = "";
  for (let i = 0; i < length; i += 1) out += TEMP_PW_ALPHABET[randomInt(TEMP_PW_ALPHABET.length)];
  return out;
}

// Fungsi: inviteUser — admin buat akun user baru langsung. Password sementara
// dikembalikan untuk dibagikan manual (tidak ada email undangan).
// Signature (prevState, formData) supaya dipakai via useActionState di client.
export async function inviteUser(prevState, formData) {
  try {
    await requireAdmin();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const full_name = String(formData.get("full_name") || "").trim() || null;
    const role = String(formData.get("role") || "staff");
    if (!email) return { ok: false, error: "Email wajib diisi." };
    if (!["admin", "manager", "staff"].includes(role)) return { ok: false, error: "Role tidak valid." };

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    try {
      await prisma.profile.create({
        data: { email, fullName: full_name, role, isActive: true, passwordHash },
      });
    } catch (err) {
      if (err?.code === "P2002") return { ok: false, error: "Email sudah terdaftar." };
      return { ok: false, error: err?.message || "Gagal membuat user." };
    }

    await logActivity({ action: "undang_user", entity: email, detail: { role } });
    revalidatePath("/settings");
    return { ok: true, email, tempPassword };
  } catch (err) {
    return { ok: false, error: err?.message || "Gagal membuat user." };
  }
}

// Fungsi: resetUserPassword — admin generate password sementara BARU untuk user.
// Signature (prevState, formData) untuk useActionState di client.
export async function resetUserPassword(prevState, formData) {
  try {
    await requireAdmin();
    const id = String(formData.get("id") || "");
    const email = String(formData.get("email") || "");
    if (!id) return { ok: false, error: "User tidak ditemukan." };

    const tempPassword = generateTempPassword();
    try {
      await prisma.profile.update({ where: { id }, data: { passwordHash: await hashPassword(tempPassword) } });
    } catch (err) {
      return { ok: false, error: err?.message || "Gagal reset password." };
    }

    await logActivity({ action: "reset_password_user", entity: email, detail: { user_id: id } });
    return { ok: true, email, tempPassword };
  } catch (err) {
    return { ok: false, error: err?.message || "Gagal reset password." };
  }
}

// Fungsi: saveUserBranches — set ulang akses cabang seorang user (many-to-many).
export async function saveUserBranches(formData) {
  const profile = await requireAdmin();
  const userId = String(formData.get("userId") || "");
  if (!userId) return;
  const branchIds = formData.getAll("branchIds").map(String);
  await prisma.$transaction([
    prisma.userBranchAccess.deleteMany({ where: { userId } }),
    ...(branchIds.length
      ? [prisma.userBranchAccess.createMany({
          data: branchIds.map((tiktokAccountId) => ({ userId, tiktokAccountId, assignedById: profile.id })),
          skipDuplicates: true,
        })]
      : []),
  ]);
  await logActivity({ action: "ubah_akses_cabang", detail: { user_id: userId, jumlah_cabang: branchIds.length } });
  revalidatePath("/settings");
}
