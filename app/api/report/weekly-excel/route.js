// File: app/api/report/weekly-excel/route.js
// Export laporan MINGGUAN (.xlsx) per cabang untuk SATU bulan: bulan dipecah jadi
// Minggu 1-5 (lib/tiktok/weekly) supaya kelihatan naik/turun performa DALAM sebulan
// — cocok untuk evaluasi kinerja tim mingguan. Runtime Node (exceljs). Auth via
// sesi user (RLS). GET /api/report/weekly-excel?branch=<id>[&month=YYYY-MM]
// Tanpa month -> otomatis pakai bulan TERBARU yang punya data.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { weeklyReport, monthDateRange, weekOfMonth } from "@/lib/tiktok/weekly";
import ExcelJS from "exceljs";

export const runtime = "nodejs";

const BULAN_NAMA = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
function labelBulan(ym) {
  const [y, m] = ym.split("-");
  return `${BULAN_NAMA[Number(m) - 1] || m} ${y}`;
}

export async function GET(request) {
  const profile = await getCurrentProfile();
  if (!profile?.role) return new Response(JSON.stringify({ error: "Belum login." }), { status: 401 });

  const url = new URL(request.url);
  const accountId = url.searchParams.get("branch");
  let month = /^\d{4}-\d{2}$/.test(url.searchParams.get("month")) ? url.searchParams.get("month") : null;
  if (!accountId) return new Response(JSON.stringify({ error: "branch wajib." }), { status: 400 });

  const supabase = await createSupabaseServerClient();
  const [{ data: account }, { data: content }, { data: overview }, { data: history }] = await Promise.all([
    supabase.from("tiktok_accounts").select("nama_cabang, tiktok_username").eq("id", accountId).maybeSingle(),
    supabase.from("tiktok_content").select("video_title, video_link, post_date, total_views, total_likes, total_comments, total_shares").eq("tiktok_account_id", accountId),
    supabase.from("tiktok_daily_overview").select("date, video_views, profile_views, likes, comments, shares").eq("tiktok_account_id", accountId),
    supabase.from("tiktok_follower_history").select("date, followers, diff_from_previous_day").eq("tiktok_account_id", accountId),
  ]);
  if (!account) return new Response(JSON.stringify({ error: "Cabang tidak ditemukan/akses ditolak." }), { status: 403 });

  // Bulan default = bulan TERBARU yang punya data (dari konten/overview/follower).
  if (!month) {
    const months = new Set();
    (content || []).forEach((r) => r.post_date && months.add(r.post_date.slice(0, 7)));
    (overview || []).forEach((r) => r.date && months.add(r.date.slice(0, 7)));
    (history || []).forEach((r) => r.date && months.add(r.date.slice(0, 7)));
    const sorted = [...months].sort();
    month = sorted.length ? sorted[sorted.length - 1] : null;
  }
  if (!month) return new Response(JSON.stringify({ error: "Belum ada data untuk cabang ini." }), { status: 404 });

  const wr = weeklyReport({ content: content || [], overview: overview || [], history: history || [] }, month);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Elio Sosmed Analyst";

  const mr = monthDateRange(month);

  // Sheet Ringkasan Mingguan (konten + follower per minggu)
  const ws = wb.addWorksheet("Ringkasan Mingguan");
  ws.columns = [{ width: 12 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 16 }];
  ws.addRow([`Laporan Mingguan ${account.nama_cabang} (@${account.tiktok_username}) — ${labelBulan(month)}`]);
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.addRow([`Periode: ${mr ? mr.label : month}. Bulan dipecah per minggu (kolom Tanggal). Views konten = akumulasi s/d hari ini.`]);
  ws.getRow(2).font = { italic: true, size: 10 };
  ws.addRow([]);
  ws.addRow(["Minggu", "Tanggal", "Jumlah Konten", "Views Konten", "Engagement", "Eng. Rate (%)", "Net Follower", "Follower Akhir"]).font = { bold: true };
  wr.content.forEach((c, i) => {
    const f = wr.follower[i] || {};
    const wk = wr.weeks[i] || {};
    ws.addRow([c.label, wk.rangeLabel || "-", c.count, c.views, c.engagement, c.engagementRate, f.netGrowth ?? 0, f.endFollowers ?? "-"]);
  });
  // Baris TOTAL bulan.
  const totalKonten = wr.content.reduce((s, c) => s + c.count, 0);
  const totalViews = wr.content.reduce((s, c) => s + c.views, 0);
  const totalEng = wr.content.reduce((s, c) => s + c.engagement, 0);
  const netFollower = wr.follower.reduce((s, f) => s + (f.netGrowth || 0), 0);
  const totalRow = ws.addRow(["TOTAL", mr ? mr.label : month, totalKonten, totalViews, totalEng, totalViews > 0 ? Math.round((totalEng / totalViews) * 10000) / 100 : 0, netFollower, wr.follower[wr.follower.length - 1]?.endFollowers ?? "-"]);
  totalRow.font = { bold: true };

  // Sheet Overview Mingguan (angka resmi TikTok yang tercatat pada minggu itu)
  const wo = wb.addWorksheet("Overview Mingguan");
  wo.columns = [{ width: 12 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 12 }, { width: 12 }, { width: 12 }];
  wo.addRow(["Overview Mingguan (angka harian TikTok yang dijumlah per minggu)"]).font = { bold: true, size: 12 };
  wo.addRow([]);
  wo.addRow(["Minggu", "Tanggal", "Video Views", "Profile Views", "Likes", "Komentar", "Shares"]).font = { bold: true };
  wr.overview.forEach((o, i) => { const wk = wr.weeks[i] || {}; wo.addRow([o.label, wk.rangeLabel || "-", o.videoViews, o.profileViews, o.likes, o.comments, o.shares]); });

  // Sheet Daftar Konten — video yang tayang pada bulan itu, ditandai minggunya.
  const eng = (v) => (Number(v.total_likes) || 0) + (Number(v.total_comments) || 0) + (Number(v.total_shares) || 0);
  const er = (v) => (Number(v.total_views) > 0 ? Math.round((eng(v) / Number(v.total_views)) * 10000) / 100 : 0);
  const konten = (content || [])
    .filter((r) => r.post_date && r.post_date.slice(0, 7) === month)
    .sort((a, b) => String(a.post_date).localeCompare(String(b.post_date)));
  const wk = wb.addWorksheet("Daftar Konten");
  wk.columns = [{ width: 12 }, { width: 10 }, { width: 50 }, { width: 45 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 12 }];
  wk.addRow([`Daftar Konten ${labelBulan(month)} (${konten.length} video)`]).font = { bold: true, size: 12 };
  wk.addRow([]);
  wk.addRow(["Tanggal", "Minggu", "Judul", "Link", "Views", "Likes", "Komentar", "Shares", "Eng. Rate (%)"]).font = { bold: true };
  konten.forEach((v) => wk.addRow([
    v.post_date,
    `Minggu ${weekOfMonth(Number(v.post_date.slice(8, 10)))}`,
    v.video_title,
    v.video_link,
    Number(v.total_views) || 0,
    Number(v.total_likes) || 0,
    Number(v.total_comments) || 0,
    Number(v.total_shares) || 0,
    er(v),
  ]));

  const buffer = await wb.xlsx.writeBuffer();
  const safeName = String(account.tiktok_username || "cabang").replace(/[^a-z0-9_-]/gi, "");
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Laporan_Mingguan_${safeName}_${month}.xlsx"`,
    },
  });
}
