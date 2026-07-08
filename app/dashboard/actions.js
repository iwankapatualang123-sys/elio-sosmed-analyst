// File: app/dashboard/actions.js
// Server Action untuk set target/goal cabang (blueprint 21A). Hanya admin/manager
// (RLS + cek role), upsert 1 baris per cabang, lalu revalidate dashboard.

"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile, canWrite } from "@/lib/auth";
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

  const supabase = await createSupabaseServerClient();
  await supabase.from("tiktok_account_goals").upsert({
    tiktok_account_id: accountId,
    target_total_views: toInt(formData.get("target_total_views")),
    target_engagement_rate: toNum(formData.get("target_engagement_rate")),
    target_net_followers: toInt(formData.get("target_net_followers")),
    updated_by: profile.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "tiktok_account_id" });
  await logActivity(supabase, { action: "set_target_cabang", entity: accountId });
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
  const supabase = await createSupabaseServerClient();
  await supabase.from("branch_annotations").insert({
    tiktok_account_id: accountId,
    note_date,
    note,
    created_by: profile.id,
    created_by_email: profile.email,
  });
  await logActivity(supabase, { action: "tambah_anotasi", entity: accountId, detail: { note_date } });
  revalidatePath("/dashboard");
}

// Hapus anotasi (pemilik atau admin — dijamin RLS).
export async function deleteAnnotation(formData) {
  const profile = await getCurrentProfile();
  if (!profile?.role) throw new Error("Belum login.");
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = await createSupabaseServerClient();
  await supabase.from("branch_annotations").delete().eq("id", id);
  revalidatePath("/dashboard");
}
