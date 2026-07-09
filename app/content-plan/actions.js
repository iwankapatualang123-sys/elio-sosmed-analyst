// File: app/content-plan/actions.js
// Server Actions untuk Rencana Konten (Content Plan). CRUD baris rencana per cabang.
// RLS (can_access_account + owner/admin) yang menjaga otorisasi; di sini fokus validasi
// ringan + revalidate. Status Uploaded/WIP dihitung saat baca (lib/tiktok/content-plan).

"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

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

// Kumpulkan field baris dari FormData jadi objek kolom tabel.
function planFields(formData) {
  const post_date = dateOrNull(formData.get("post_date"));
  // plan_month diambil dari post_date; kalau kosong pakai field bulan eksplisit atau bulan ini.
  const explicitMonth = String(formData.get("plan_month") || "").trim(); // 'YYYY-MM'
  const plan_month =
    monthFirstDay(post_date) ||
    (/^\d{4}-\d{2}$/.test(explicitMonth) ? `${explicitMonth}-01` : null) ||
    `${new Date().toISOString().slice(0, 7)}-01`;

  return {
    plan_month,
    post_date,
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

  const fields = planFields(formData);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("content_plans").insert({
    tiktok_account_id: accountId,
    ...fields,
    created_by: profile.id,
    created_by_email: profile.email,
  });
  if (error) throw new Error(`Gagal menyimpan rencana: ${error.message}`);
  await logActivity(supabase, { action: "tambah_rencana_konten", entity: accountId, detail: { headline: fields.headline } });
  revalidatePath("/content-plan");
}

// Perbarui baris rencana (RLS: pemilik atau admin/manager).
export async function updatePlan(formData) {
  const profile = await getCurrentProfile();
  if (!profile?.role) throw new Error("Belum login.");
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("ID rencana tidak ada.");

  const fields = planFields(formData);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("content_plans")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Gagal memperbarui rencana: ${error.message}`);
  await logActivity(supabase, { action: "ubah_rencana_konten", entity: id });
  revalidatePath("/content-plan");
}

// Hapus baris rencana (RLS: pemilik atau admin).
export async function deletePlan(formData) {
  const profile = await getCurrentProfile();
  if (!profile?.role) throw new Error("Belum login.");
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("content_plans").delete().eq("id", id);
  if (error) throw new Error(`Gagal menghapus rencana: ${error.message}`);
  await logActivity(supabase, { action: "hapus_rencana_konten", entity: id });
  revalidatePath("/content-plan");
}

// Set cepat link konten tayang (posted_url) dari input inline di tabel. Setelah ini
// status akan otomatis dihitung ulang (Verified bila cocok data report).
export async function setPostedUrl(formData) {
  const profile = await getCurrentProfile();
  if (!profile?.role) throw new Error("Belum login.");
  const id = String(formData.get("id") || "");
  if (!id) return;
  const url = String(formData.get("posted_url") || "").trim() || null;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("content_plans")
    .update({ posted_url: url, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Gagal menyimpan link: ${error.message}`);
  await logActivity(supabase, { action: "set_link_tayang_rencana", entity: id });
  revalidatePath("/content-plan");
  revalidatePath("/dashboard");
}

// Toggle cepat ACC to POSTING (checkbox di tabel).
export async function toggleAcc(formData) {
  const profile = await getCurrentProfile();
  if (!profile?.role) throw new Error("Belum login.");
  const id = String(formData.get("id") || "");
  const next = String(formData.get("next") || "") === "true";
  if (!id) return;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("content_plans")
    .update({ acc_to_posting: next, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Gagal mengubah ACC: ${error.message}`);
  revalidatePath("/content-plan");
}
