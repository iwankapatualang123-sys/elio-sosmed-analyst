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

// ————————————————————————————————————————————————————————————————
// UPLOAD EXPORT INSTAGRAM (Meta Business Suite), banyak file sekaligus.
// Jenis tiap file dideteksi otomatis oleh parser (lib/instagram/parser):
//  - metrik harian  -> upsert instagram_daily_metrics per (cabang, metrik, tanggal)
//  - per konten     -> upsert instagram_content per (cabang, post_id) — angka
//                      "Sepanjang Masa" jadi upload ulang memperbarui angka lama.
// Hasil per file dilaporkan terpisah supaya file yang gagal tidak menggagalkan
// file lain (tim biasa upload 4-5 file sekali jalan).
// ————————————————————————————————————————————————————————————————
export async function uploadInstagramFiles(formData) {
  const profile = await getCurrentProfile();
  if (!profile?.role) throw new Error("Belum login.");
  if (!canWrite(profile)) throw new Error("Role Anda hanya bisa melihat data (admin & manager yang boleh upload).");
  const accountId = String(formData.get("accountId") || "");
  if (!accountId) throw new Error("Cabang wajib dipilih.");
  const files = formData.getAll("files").filter((f) => f && typeof f.arrayBuffer === "function");
  if (files.length === 0) throw new Error("Pilih minimal 1 file CSV.");

  const { parseInstagramFile } = await import("@/lib/instagram/parser");
  const supabase = await createSupabaseServerClient();
  const results = [];

  for (const file of files) {
    try {
      const parsed = parseInstagramFile(Buffer.from(await file.arrayBuffer()));
      if (parsed.kind === "daily") {
        const rows = parsed.rows.map((r) => ({
          tiktok_account_id: accountId,
          metric: parsed.metric,
          date: r.date,
          value: r.value,
          created_by: profile.id,
          created_by_email: profile.email,
          updated_at: new Date().toISOString(),
        }));
        const { error } = await supabase
          .from("instagram_daily_metrics")
          .upsert(rows, { onConflict: "tiktok_account_id,metric,date" });
        if (error) throw new Error(error.message);
        results.push({ name: file.name, ok: true, kind: "daily", metric: parsed.metric, metricLabel: parsed.metricLabel, rows: rows.length, from: parsed.rows[0].date, to: parsed.rows[parsed.rows.length - 1].date });
      } else {
        const rows = parsed.rows.map((r) => ({
          tiktok_account_id: accountId,
          post_id: r.post_id,
          ig_account_id: r.ig_account_id,
          username: r.username,
          account_name: r.account_name,
          description: r.description,
          duration_s: r.duration_s,
          published_at: r.published_at,
          permalink: r.permalink,
          post_type: r.post_type,
          views: r.views,
          reach: r.reach,
          likes: r.likes,
          comments: r.comments,
          shares: r.shares,
          saves: r.saves,
          profile_visits: r.profile_visits,
          replies: r.replies,
          navigation: r.navigation,
          sticker_taps: r.sticker_taps,
          follows: r.follows,
          is_collab: r.is_collab,
          created_by: profile.id,
          created_by_email: profile.email,
          updated_at: new Date().toISOString(),
        }));
        const { error } = await supabase
          .from("instagram_content")
          .upsert(rows, { onConflict: "tiktok_account_id,post_id" });
        if (error) throw new Error(error.message);
        const collab = rows.filter((r) => r.is_collab).length;
        results.push({ name: file.name, ok: true, kind: "content", rows: rows.length, collab });
      }
    } catch (err) {
      results.push({ name: file.name, ok: false, error: err?.message || "Gagal memproses file." });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  if (okCount > 0) {
    await logActivity(supabase, {
      action: "upload_data_instagram",
      entity: accountId,
      detail: { files: results.map((r) => ({ name: r.name, ok: r.ok, kind: r.kind, rows: r.rows })) },
    });
    revalidatePath("/upload");
    revalidatePath("/dashboard");
  }
  return { results };
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
