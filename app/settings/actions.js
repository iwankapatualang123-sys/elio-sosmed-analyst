// File: app/settings/actions.js
// Server Actions untuk manajemen cabang & user (khusus admin). Semua aksi memakai
// client Supabase terikat sesi (RLS: hanya admin yang boleh menulis), lalu
// revalidate halaman /settings. Blueprint bagian 20/21D.

"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/audit";

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
  await logActivity(supabase, { action: "tambah_cabang", entity: nama_cabang, detail: { tiktok_username } });
  revalidatePath("/settings");
}

// Fungsi: toggleBranchActive — aktif/nonaktifkan cabang (arsip tanpa hapus data).
export async function toggleBranchActive(formData) {
  const supabase = await requireAdmin();
  const id = String(formData.get("id") || "");
  const next = String(formData.get("next") || "") === "true";
  if (!id) return;
  await supabase.from("tiktok_accounts").update({ is_active: next }).eq("id", id);
  await logActivity(supabase, { action: next ? "aktifkan_cabang" : "nonaktifkan_cabang", entity: id });
  revalidatePath("/settings");
}

// Fungsi: setUserRole — ubah role user (admin/manager/staff).
export async function setUserRole(formData) {
  const supabase = await requireAdmin();
  const id = String(formData.get("id") || "");
  const role = String(formData.get("role") || "");
  if (!id || !["admin", "manager", "staff"].includes(role)) return;
  await supabase.from("profiles").update({ role }).eq("id", id);
  await logActivity(supabase, { action: "ubah_role_user", entity: role, detail: { user_id: id } });
  revalidatePath("/settings");
}

// Fungsi: toggleUserActive — aktif/nonaktifkan user.
export async function toggleUserActive(formData) {
  const supabase = await requireAdmin();
  const id = String(formData.get("id") || "");
  const next = String(formData.get("next") || "") === "true";
  if (!id) return;
  await supabase.from("profiles").update({ is_active: next }).eq("id", id);
  await logActivity(supabase, { action: next ? "aktifkan_user" : "nonaktifkan_user", detail: { user_id: id } });
  revalidatePath("/settings");
}

// Fungsi: generateTempPassword — password sementara acak (server-only, aman via crypto).
function generateTempPassword() {
  return randomBytes(9).toString("base64url");
}

// Fungsi: inviteUser — admin buat akun user baru langsung (Admin API, service_role).
// Tidak kirim email undangan (email Supabase paket Free kurang andal) — password
// sementara dikembalikan untuk ditampilkan & dibagikan manual oleh admin.
// Signature (prevState, formData) supaya dipakai via useActionState di client.
export async function inviteUser(prevState, formData) {
  try {
    const supabase = await requireAdmin();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const full_name = String(formData.get("full_name") || "").trim();
    const role = String(formData.get("role") || "staff");
    if (!email) return { ok: false, error: "Email wajib diisi." };
    if (!["admin", "manager", "staff"].includes(role)) return { ok: false, error: "Role tidak valid." };

    const admin = createSupabaseAdminClient();
    const tempPassword = generateTempPassword();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: full_name ? { full_name } : undefined,
    });
    if (error) return { ok: false, error: error.message };

    // Trigger handle_new_user sudah membuat profil (role default 'staff'). Set
    // role sesuai pilihan admin kalau bukan staff.
    if (role !== "staff") {
      await supabase.from("profiles").update({ role }).eq("id", data.user.id);
    }

    await logActivity(supabase, { action: "undang_user", entity: email, detail: { role } });
    revalidatePath("/settings");
    return { ok: true, email, tempPassword };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : "Gagal membuat user." };
  }
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
  await logActivity(supabase, { action: "ubah_akses_cabang", detail: { user_id: userId, jumlah_cabang: branchIds.length } });
  revalidatePath("/settings");
}
