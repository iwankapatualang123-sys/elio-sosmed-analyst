// File: app/upload/actions.js
// Server Action input manual snapshot akun Instagram/Threads (Lapis 1 laporan
// non-TikTok). Upsert per (cabang, platform, tanggal) — input ulang di hari yang
// sama MENIMPA angka hari itu (koreksi typo), hari berbeda menambah deret waktu.

"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db";
import { getCurrentProfile, canWrite } from "@/lib/auth";
import { assertCanAccess } from "@/lib/access";
import { logActivity } from "@/lib/audit";
import { SNAPSHOT_PLATFORM_KEYS } from "@/lib/social/snapshots";

// Angka dari input longgar ("1.234" / "1,234" / " 1234 ") -> int; kosong -> null.
function intOrNull(v) {
  const s = String(v ?? "").replace(/[^\d]/g, "");
  if (s === "") return null;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

// Tanggal longgar -> Date (untuk kolom @db.Date / DateTime Prisma); kosong -> null.
function toDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
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
  await assertCanAccess(profile, accountId);
  const files = formData.getAll("files").filter((f) => f && typeof f.arrayBuffer === "function");
  if (files.length === 0) throw new Error("Pilih minimal 1 file CSV.");

  const { parseInstagramFile } = await import("@/lib/instagram/parser");
  const results = [];

  for (const file of files) {
    try {
      const parsed = parseInstagramFile(Buffer.from(await file.arrayBuffer()));
      if (parsed.kind === "daily") {
        for (const r of parsed.rows) {
          const base = {
            value: r.value,
            createdById: profile.id,
            createdByEmail: profile.email,
          };
          await prisma.instagramDailyMetric.upsert({
            where: {
              tiktokAccountId_metric_date: {
                tiktokAccountId: accountId,
                metric: parsed.metric,
                date: toDate(r.date),
              },
            },
            create: { tiktokAccountId: accountId, metric: parsed.metric, date: toDate(r.date), ...base },
            update: base,
          });
        }
        results.push({ name: file.name, ok: true, kind: "daily", metric: parsed.metric, metricLabel: parsed.metricLabel, rows: parsed.rows.length, from: parsed.rows[0].date, to: parsed.rows[parsed.rows.length - 1].date });
      } else {
        let collab = 0;
        for (const r of parsed.rows) {
          if (r.is_collab) collab += 1;
          const base = {
            igAccountId: r.ig_account_id,
            username: r.username,
            accountName: r.account_name,
            description: r.description,
            durationS: r.duration_s,
            publishedAt: toDate(r.published_at),
            permalink: r.permalink,
            postType: r.post_type,
            views: r.views,
            reach: r.reach,
            likes: r.likes,
            comments: r.comments,
            shares: r.shares,
            saves: r.saves,
            profileVisits: r.profile_visits,
            replies: r.replies,
            navigation: r.navigation,
            stickerTaps: r.sticker_taps,
            follows: r.follows,
            isCollab: !!r.is_collab,
            createdById: profile.id,
            createdByEmail: profile.email,
          };
          await prisma.instagramContent.upsert({
            where: { tiktokAccountId_postId: { tiktokAccountId: accountId, postId: r.post_id } },
            create: { tiktokAccountId: accountId, postId: r.post_id, ...base },
            update: base,
          });
        }
        results.push({ name: file.name, ok: true, kind: "content", rows: parsed.rows.length, collab });
      }
    } catch (err) {
      results.push({ name: file.name, ok: false, error: err?.message || "Gagal memproses file." });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  if (okCount > 0) {
    await logActivity({
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
  await assertCanAccess(profile, accountId);
  const platform = String(formData.get("platform") || "");
  if (!SNAPSHOT_PLATFORM_KEYS.includes(platform)) throw new Error("Platform tidak dikenal.");
  const snapshot_date = String(formData.get("snapshot_date") || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshot_date)) throw new Error("Tanggal snapshot tidak valid.");

  const followers = intOrNull(formData.get("followers"));
  if (followers == null) throw new Error("Jumlah followers wajib diisi (angka).");
  const reach_30d = intOrNull(formData.get("reach_30d"));
  const profile_visits = intOrNull(formData.get("profile_visits"));

  const base = {
    followers,
    reach30d: reach_30d,
    profileVisits: profile_visits,
    createdById: profile.id,
    createdByEmail: profile.email,
  };
  try {
    await prisma.socialAccountSnapshot.upsert({
      where: {
        tiktokAccountId_platform_snapshotDate: {
          tiktokAccountId: accountId,
          platform,
          snapshotDate: toDate(snapshot_date),
        },
      },
      create: { tiktokAccountId: accountId, platform, snapshotDate: toDate(snapshot_date), ...base },
      update: base,
    });
  } catch (err) {
    throw new Error(`Gagal menyimpan snapshot: ${err?.message || err}`);
  }

  await logActivity({
    action: "input_snapshot_sosmed",
    entity: accountId,
    detail: { platform, snapshot_date, followers },
  });
  revalidatePath("/upload");
  revalidatePath("/dashboard");
  return { ok: true };
}
