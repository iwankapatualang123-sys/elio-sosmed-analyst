// File: app/upload/actions.js
// Server Action input manual snapshot akun Instagram/Threads (Lapis 1 laporan
// non-TikTok). Upsert per (cabang, platform, tanggal) — input ulang di hari yang
// sama MENIMPA angka hari itu (koreksi typo), hari berbeda menambah deret waktu.

"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile, canWrite } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { SNAPSHOT_PLATFORM_KEYS } from "@/lib/social/snapshots";

// Angka dari input longgar ("1.234" / "1,234" / " 1234 ") -> int; kosong -> null.
function intOrNull(v) {
  const s = String(v ?? "").replace(/[^\d]/g, "");
  if (s === "") return null;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

export async function saveSocialSnapshot(formData) {
  const profile = await getCurrentProfile();
  if (!profile?.role) throw new Error("Belum login.");
  if (!canWrite(profile)) throw new Error("Role Anda hanya bisa melihat data (admin & manager yang boleh input).");

  const accountId = String(formData.get("accountId") || "");
  if (!accountId) throw new Error("Cabang wajib dipilih.");
  const platform = String(formData.get("platform") || "");
  if (!SNAPSHOT_PLATFORM_KEYS.includes(platform)) throw new Error("Platform tidak dikenal.");
  const snapshot_date = String(formData.get("snapshot_date") || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshot_date)) throw new Error("Tanggal snapshot tidak valid.");

  const followers = intOrNull(formData.get("followers"));
  if (followers == null) throw new Error("Jumlah followers wajib diisi (angka).");
  const reach_30d = intOrNull(formData.get("reach_30d"));
  const profile_visits = intOrNull(formData.get("profile_visits"));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("social_account_snapshots").upsert(
    {
      tiktok_account_id: accountId,
      platform,
      snapshot_date,
      followers,
      reach_30d,
      profile_visits,
      created_by: profile.id,
      created_by_email: profile.email,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tiktok_account_id,platform,snapshot_date" }
  );
  if (error) throw new Error(`Gagal menyimpan snapshot: ${error.message}`);

  await logActivity(supabase, {
    action: "input_snapshot_sosmed",
    entity: accountId,
    detail: { platform, snapshot_date, followers },
  });
  revalidatePath("/upload");
  revalidatePath("/dashboard");
  return { ok: true };
}
