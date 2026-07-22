// File: app/api/report/excel/route.js
// Export laporan Excel (.xlsx) per cabang: sheet Ringkasan (KPI + insight) + data
// mentah (Konten, Follower, Viewers). Blueprint bagian 7. Runtime Node (exceljs).
// Auth via sesi user (RLS). GET /api/report/excel?branch=<id>

import { createReadClient } from "@/lib/db-compat";
import { getCurrentProfile } from "@/lib/auth";
import metrics from "@/lib/tiktok/metrics.js";
import { generateInsights } from "@/lib/tiktok/insights";
import { buildBranchReportWorkbook } from "@/lib/tiktok/report-excel";

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

  const wb = buildBranchReportWorkbook({
    account, month, generatedAt: new Date().toISOString(),
    cs, growth, vr, insights, history, viewers,
  });
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
