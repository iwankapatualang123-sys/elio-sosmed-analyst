// File: app/settings/actions.js
// Server Actions untuk manajemen cabang & user (khusus admin). Semua aksi memakai
// client Supabase terikat sesi (RLS: hanya admin yang boleh menulis), lalu
// revalidate halaman /settings. Blueprint bagian 20/21D.

"use server";

import { randomInt } from "crypto";
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

// Fungsi: updateBranch — ubah nama/username/kategori cabang (bukan hapus data, aman).
export async function updateBranch(formData) {
  const supabase = await requireAdmin();
  const id = String(formData.get("id") || "");
  const nama_cabang = String(formData.get("nama_cabang") || "").trim();
  const tiktok_username = String(formData.get("tiktok_username") || "").trim().replace(/^@/, "").toLowerCase();
  const kategori = String(formData.get("kategori") || "").trim() || null;
  if (!id || !nama_cabang || !tiktok_username) throw new Error("Nama cabang dan username wajib diisi.");
  const { error } = await supabase.from("tiktok_accounts").update({ nama_cabang, tiktok_username, kategori }).eq("id", id);
  if (error) throw new Error(`Gagal memperbarui cabang: ${error.message}`);
  await logActivity(supabase, { action: "ubah_cabang", entity: id, detail: { nama_cabang, tiktok_username } });
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/data");
  revalidatePath("/calendar");
  revalidatePath("/content-plan");
}

// Fungsi: deleteBranch — hapus PERMANEN sebuah cabang beserta SEMUA data terkait
// (konten, overview harian, riwayat follower, target, anotasi, rencana konten —
// semua di-cascade lewat FK "on delete cascade"). Beda dari toggleBranchActive
// (arsip, data tetap ada) — ini tidak bisa dibatalkan, jadi wajib konfirmasi nama
// cabang PERSIS cocok (dicek di server, bukan cuma di UI) sebelum dieksekusi.
export async function deleteBranch(formData) {
  const supabase = await requireAdmin();
  const id = String(formData.get("id") || "");
  const confirmName = String(formData.get("confirmName") || "").trim();
  if (!id) return;

  const { data: branch } = await supabase.from("tiktok_accounts").select("nama_cabang").eq("id", id).maybeSingle();
  if (!branch) throw new Error("Cabang tidak ditemukan.");
  if (confirmName !== branch.nama_cabang) {
    throw new Error("Nama konfirmasi tidak cocok — penghapusan dibatalkan.");
  }

  const { error } = await supabase.from("tiktok_accounts").delete().eq("id", id);
  if (error) throw new Error(`Gagal menghapus cabang: ${error.message}`);
  await logActivity(supabase, { action: "hapus_cabang_permanen", entity: id, detail: { nama_cabang: branch.nama_cabang } });
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/data");
  revalidatePath("/calendar");
  revalidatePath("/content-plan");
  revalidatePath("/upload");
}

// Fungsi: addCategory — tambah nilai baru ke kategori Rencana Konten (PIC/Goals/
// Pillar/Type). Dipakai isi dropdown form Rencana Konten (app/content-plan).
export async function addCategory(formData) {
  const supabase = await requireAdmin();
  const category_type = String(formData.get("category_type") || "");
  const value = String(formData.get("value") || "").trim();
  if (!["pic", "goals", "pillar", "type"].includes(category_type) || !value) return;
  const { error } = await supabase.from("content_plan_categories").insert({ category_type, value });
  // Duplikat (unique constraint) diabaikan senyap — bukan error yang perlu ditampilkan.
  if (error && error.code !== "23505") throw new Error(`Gagal menambah kategori: ${error.message}`);
  await logActivity(supabase, { action: "tambah_kategori_rencana", entity: value, detail: { category_type } });
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

// Fungsi: setAccountGoal — set target 1 cabang untuk 1 PLATFORM (tiktok/instagram).
// Upsert per (cabang, platform). Target kosong = tidak dipasang (null).
export async function setAccountGoal(formData) {
  const supabase = await requireAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  const accountId = String(formData.get("accountId") || "");
  const platform = String(formData.get("platform") || "");
  if (!accountId || !["tiktok", "instagram"].includes(platform)) return;
  const { error } = await supabase.from("tiktok_account_goals").upsert({
    tiktok_account_id: accountId,
    platform,
    target_total_views: goalInt(formData.get("target_total_views")),
    target_engagement_rate: goalNum(formData.get("target_engagement_rate")),
    target_net_followers: goalInt(formData.get("target_net_followers")),
    updated_by: user?.id || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "tiktok_account_id,platform" });
  if (error) throw new Error(`Gagal menyimpan target: ${error.message}`);
  await logActivity(supabase, { action: "set_target_cabang", entity: accountId, detail: { platform } });
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

// Fungsi: deleteCategory — hapus satu nilai kategori (baris rencana yang sudah
// terlanjur memakai nilai ini TIDAK berubah — hanya tidak lagi jadi pilihan baru).
export async function deleteCategory(formData) {
  const supabase = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await supabase.from("content_plan_categories").delete().eq("id", id);
  await logActivity(supabase, { action: "hapus_kategori_rencana", entity: id });
  revalidatePath("/settings");
  revalidatePath("/content-plan");
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

// Alfabet TANPA karakter ambigu (tidak ada 0/O, 1/l/I) — password sementara ini
// sering dibagikan manual (WA/lisan) & diketik ulang orang lain, jadi salah
// baca/ketik harus diminimalkan. ~5.78 bit/karakter; 14 karakter -> ~81 bit entropi.
const TEMP_PW_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

// Fungsi: generateTempPassword — password sementara acak (server-only, crypto-safe,
// tanpa karakter yang gampang tertukar saat dibagikan/diketik ulang manual).
function generateTempPassword(length = 14) {
  let out = "";
  for (let i = 0; i < length; i += 1) out += TEMP_PW_ALPHABET[randomInt(TEMP_PW_ALPHABET.length)];
  return out;
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

// Fungsi: resetUserPassword — admin generate password sementara BARU untuk user
// (Admin API, service_role). Dipakai saat password awal terlewat/lupa — password
// lama tidak bisa "dilihat lagi" karena memang tidak pernah disimpan di mana pun.
// Signature (prevState, formData) untuk useActionState di client.
export async function resetUserPassword(prevState, formData) {
  try {
    const supabase = await requireAdmin();
    const id = String(formData.get("id") || "");
    const email = String(formData.get("email") || "");
    if (!id) return { ok: false, error: "User tidak ditemukan." };

    const admin = createSupabaseAdminClient();
    const tempPassword = generateTempPassword();
    const { error } = await admin.auth.admin.updateUserById(id, { password: tempPassword });
    if (error) return { ok: false, error: error.message };

    await logActivity(supabase, { action: "reset_password_user", entity: email, detail: { user_id: id } });
    return { ok: true, email, tempPassword };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : "Gagal reset password." };
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
