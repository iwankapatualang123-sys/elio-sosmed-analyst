// File: app/api/report/excel/route.js
// Export laporan Excel (.xlsx) per cabang: sheet Ringkasan (KPI + insight) + data
// mentah (Konten, Follower, Viewers). Blueprint bagian 7. Runtime Node (exceljs).
// Auth via sesi user (RLS). GET /api/report/excel?branch=<id>

import { createReadClient } from "@/lib/db-compat";
import { getCurrentProfile } from "@/lib/auth";
import metrics from "@/lib/tiktok/metrics.js";
import { generateInsights } from "@/lib/tiktok/insights";
import ExcelJS from "exceljs";

export const runtime = "nodejs";

export async function GET(request) {
  const profile = await getCurrentProfile();
  if (!profile?.role) return new Response(JSON.stringify({ error: "Belum login." }), { status: 401 });

  const url = new URL(request.url);
  const accountId = url.searchParams.get("branch");
  const month = /^\d{4}-\d{2}$/.test(url.searchParams.get("month")) ? url.searchParams.get("month") : null;
  if (!accountId) return new Response(JSON.stringify({ error: "branch wajib." }), { status: 400 });

  const supabase = await createReadClient(profile);
  const [{ data: account }, { data: contentAll }, { data: historyAll }, { data: viewersAll }] = await Promise.all([
    supabase.from("tiktok_accounts").select("nama_cabang, tiktok_username").eq("id", accountId).maybeSingle(),
    supabase.from("tiktok_content").select("*").eq("tiktok_account_id", accountId),
    supabase.from("tiktok_follower_history").select("*").eq("tiktok_account_id", accountId).order("date"),
    supabase.from("tiktok_viewers").select("*").eq("tiktok_account_id", accountId).order("date"),
  ]);
  if (!account) return new Response(JSON.stringify({ error: "Cabang tidak ditemukan/akses ditolak." }), { status: 403 });

  // Scope ke 1 bulan kalau diminta (mis. laporan April 2026) — tanpa month = sepanjang masa (lama).
  const inMonth = (d) => !month || (typeof d === "string" && d.slice(0, 7) === month);
  const content = (contentAll || []).filter((r) => inMonth(r.post_date));
  const history = (historyAll || []).filter((r) => inMonth(r.date));
  const viewers = (viewersAll || []).filter((r) => inMonth(r.date));

  const cs = metrics.summarizeContent(content);
  const growth = metrics.followerGrowth(history);
  const vr = metrics.viewersRatio(viewers);
  const insights = generateInsights({ summary: cs, growth, viewers: vr, bestHours: metrics.bestPostingTimes([]) });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Elio Sosmed Analyst";

  // Sheet Ringkasan
  const ws = wb.addWorksheet("Ringkasan");
  ws.columns = [{ width: 28 }, { width: 40 }, { width: 40 }];
  ws.addRow([`Laporan ${account.nama_cabang} (@${account.tiktok_username})${month ? ` — ${month}` : " — sepanjang masa"}`]);
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.addRow([]);
  ws.addRow(["Metrik", "Nilai"]).font = { bold: true };
  [
    ["Total konten", cs.totalVideos],
    ["Total views", cs.totalViews],
    ["Rata-rata views/konten", cs.avgViewsPerPost],
    ["Engagement rate (%)", cs.engagementRateOverall],
    ["Follower awal → akhir", `${growth.startFollowers} → ${growth.endFollowers}`],
    ["Net pertumbuhan follower", growth.netGrowth],
    ["Penonton baru (%)", vr.newPct],
    ["Penonton kembali (%)", vr.returningPct],
  ].forEach((r) => ws.addRow(r));
  ws.addRow([]);
  ws.addRow(["Aspek", "Kesimpulan", "Saran"]).font = { bold: true };
  insights.forEach((i) => ws.addRow([i.aspek, i.kesimpulan, i.saran]));

  // Sheet Data Konten (video yang tayang pada periode; kolom Minggu = minggu ke-berapa
  // dalam bulannya, berguna saat laporan discope 1 bulan).
  const wc = wb.addWorksheet("Data Konten");
  wc.addRow(["Tanggal Post", "Minggu", "Judul", "Link", "Views", "Likes", "Comments", "Shares", "Eng. rate (%)"]).font = { bold: true };
  wc.columns = [{ width: 14 }, { width: 10 }, { width: 50 }, { width: 45 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 12 }];
  [...(cs.videos || [])]
    .sort((a, b) => String(a.post_date).localeCompare(String(b.post_date)))
    .forEach((v) => {
      const wkNo = v.post_date ? Math.min(5, Math.ceil(Number(String(v.post_date).slice(8, 10)) / 7)) : "-";
      wc.addRow([v.post_date, wkNo === "-" ? "-" : `Minggu ${wkNo}`, v.video_title, v.video_link, v.total_views, v.total_likes, v.total_comments, v.total_shares, v.engagement_rate]);
    });

  // Sheet Follower
  const wf = wb.addWorksheet("Follower");
  wf.addRow(["Tanggal", "Followers", "Selisih harian"]).font = { bold: true };
  (history || []).forEach((r) => wf.addRow([r.date, r.followers, r.diff_from_previous_day]));

  // Sheet Viewers
  const wv = wb.addWorksheet("Viewers");
  wv.addRow(["Tanggal", "Total", "Baru", "Kembali", "Belum lengkap"]).font = { bold: true };
  (viewers || []).forEach((r) => wv.addRow([r.date, r.total_viewers, r.new_viewers, r.returning_viewers, r.is_incomplete ? "ya" : ""]));

  const buffer = await wb.xlsx.writeBuffer();
  const safeName = String(account.tiktok_username || "cabang").replace(/[^a-z0-9_-]/gi, "");
  const fileSuffix = month ? `_${month}` : "";
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Laporan_${safeName}${fileSuffix}.xlsx"`,
    },
  });
}
