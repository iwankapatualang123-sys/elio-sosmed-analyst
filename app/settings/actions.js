// File: app/settings/actions.js
// Server Actions untuk manajemen cabang & user (khusus admin). Semua aksi memakai
// client Supabase terikat sesi (RLS: hanya admin yang boleh menulis), lalu
// revalidate halaman /settings. Blueprint bagian 20/21D.

"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Fungsi: requireAdmin — pastikan pemanggil adalah admin, kembalikan client Supabase.
async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Belum login.");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") throw new Error("Hanya admin.");
  return supabase;
}

// Fungsi: addBranch — tambah cabang TikTok baru.
export async function addBranch(formData) {
  const supabase = await requireAdmin();
  const nama_cabang = String(formData.get("nama_cabang") || "").trim();
  const tiktok_username = String(formData.get("tiktok_username") || "").trim().replace(/^@/, "").toLowerCase();
  const kategori = String(formData.get("kategori") || "").trim() || null;
  if (!nama_cabang || !tiktok_username) return;
  await supabase.from("tiktok_accounts").insert({ nama_cabang, tiktok_username, kategori, is_active: true });
  revalidatePath("/settings");
}

// Fungsi: toggleBranchActive — aktif/nonaktifkan cabang (arsip tanpa hapus data).
export async function toggleBranchActive(formData) {
  const supabase = await requireAdmin();
  const id = String(formData.get("id") || "");
  const next = String(formData.get("next") || "") === "true";
  if (!id) return;
  await supabase.from("tiktok_accounts").update({ is_active: next }).eq("id", id);
  revalidatePath("/settings");
}

// Fungsi: setUserRole — ubah role user (admin/manager/staff).
export async function setUserRole(formData) {
  const supabase = await requireAdmin();
  const id = String(formData.get("id") || "");
  const role = String(formData.get("role") || "");
  if (!id || !["admin", "manager", "staff"].includes(role)) return;
  await supabase.from("profiles").update({ role }).eq("id", id);
  revalidatePath("/settings");
}

// Fungsi: toggleUserActive — aktif/nonaktifkan user.
export async function toggleUserActive(formData) {
  const supabase = await requireAdmin();
  const id = String(formData.get("id") || "");
  const next = String(formData.get("next") || "") === "true";
  if (!id) return;
  await supabase.from("profiles").update({ is_active: next }).eq("id", id);
  revalidatePath("/settings");
}

// Fungsi: saveUserBranches — set ulang akses cabang seorang user (many-to-many).
// Hapus semua akses lama user lalu insert daftar cabang terpilih.
export async function saveUserBranches(formData) {
  const supabase = await requireAdmin();
  const userId = String(formData.get("userId") || "");
  if (!userId) return;
  const branchIds = formData.getAll("branchIds").map(String);
  await supabase.from("user_branch_access").delete().eq("user_id", userId);
  if (branchIds.length) {
    await supabase.from("user_branch_access").insert(branchIds.map((tiktok_account_id) => ({ user_id: userId, tiktok_account_id })));
  }
  revalidatePath("/settings");
}
