// File: lib/tiktok/analytics.js
// Tujuan: memuat data TikTok dari Supabase lalu menghitung metrik (via metrics.js)
// untuk dashboard. Menerima client Supabase terikat sesi (RLS berlaku).
// Modul ESM (dipakai Server Component). metrics.js (CJS) diimpor sebagai default.

import metrics from "./metrics.js";
import { generateInsights } from "./insights.js";
import { evaluateAlerts } from "./alerts.js";

// Fungsi: currentMonth — string 'YYYY-MM' bulan berjalan (UTC).
function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

// Fungsi: loadPortfolio
// Ringkasan lintas cabang untuk KPI + tabel ranking (blueprint bagian 4).
// Input: supabase client. Output (async): { branches:[summaryPerCabang], portfolio:{KPI} }.
export async function loadPortfolio(supabase) {
  const { data: accounts } = await supabase
    .from("tiktok_accounts")
    .select("id, nama_cabang, tiktok_username, kategori")
    .eq("is_active", true)
    .order("nama_cabang");
  const branches = [];
  for (const acc of accounts || []) {
    const [{ data: content }, { data: history }] = await Promise.all([
      supabase.from("tiktok_content").select("*").eq("tiktok_account_id", acc.id),
      supabase.from("tiktok_follower_history").select("*").eq("tiktok_account_id", acc.id),
    ]);
    const cs = metrics.summarizeContent(content || []);
    const fg = metrics.followerGrowth(history || []);
    const month = metrics.contentPerMonth(content || []).find((m) => m.month === currentMonth());
    branches.push({
      id: acc.id,
      nama_cabang: acc.nama_cabang,
      tiktok_username: acc.tiktok_username,
      kategori: acc.kategori || null,
      totalContent: cs.totalVideos,
      contentThisMonth: month ? month.count : 0,
      totalViews: cs.totalViews,
      totalEngagement: cs.totalEngagement,
      avgViewsPerPost: cs.avgViewsPerPost,
      engagementRate: cs.engagementRateOverall,
      netFollowerGrowth: fg.netGrowth,
      endFollowers: fg.endFollowers,
      status: metrics.benchmark(fg.endFollowers, fg.startFollowers).status,
    });
  }
  const totalViews = branches.reduce((s, b) => s + b.totalViews, 0);
  const totalEngagement = branches.reduce((s, b) => s + b.totalEngagement, 0);
  const portfolio = {
    activeBranches: branches.length,
    totalContentThisMonth: branches.reduce((s, b) => s + b.contentThisMonth, 0),
    totalViews,
    netFollowerGrowth: branches.reduce((s, b) => s + b.netFollowerGrowth, 0),
    avgEngagementRate: totalViews > 0 ? Math.round((totalEngagement / totalViews) * 10000) / 100 : 0,
  };
  return { branches, portfolio };
}

// Fungsi: loadBranchDetail
// Metrik lengkap satu cabang untuk grafik detail (tren follower, gender, lokasi,
// viewers, jam terbaik, top video). Input: supabase, accountId.
// Output (async): objek detail, atau null kalau cabang tidak ada/akses ditolak.
export async function loadBranchDetail(supabase, accountId) {
  if (!accountId) return null;
  const [content, history, viewers, activity, gender, territories] = await Promise.all([
    supabase.from("tiktok_content").select("*").eq("tiktok_account_id", accountId),
    supabase.from("tiktok_follower_history").select("*").eq("tiktok_account_id", accountId).order("date"),
    supabase.from("tiktok_viewers").select("*").eq("tiktok_account_id", accountId),
    supabase.from("tiktok_follower_activity").select("*").eq("tiktok_account_id", accountId),
    supabase.from("tiktok_follower_gender").select("*").eq("tiktok_account_id", accountId).order("snapshot_date", { ascending: false }).limit(1),
    supabase.from("tiktok_follower_territories").select("*").eq("tiktok_account_id", accountId).order("distribution_pct", { ascending: false }),
  ]);

  const contentRows = content.data || [];
  const cs = metrics.summarizeContent(contentRows);
  const growth = metrics.followerGrowth(history.data || []);
  const viewersRatio = metrics.viewersRatio(viewers.data || []);
  const bestHours = metrics.bestPostingTimes(activity.data || [], { top: 5 });
  const hashtags = metrics.hashtagStats(contentRows, { limit: 8 });
  const topVideos = metrics.rankVideos(cs.videos, { by: "views", limit: 5 });

  // Bahan untuk peringatan/alert.
  const contentThisMonth = metrics.contentPerMonth(contentRows).find((m) => m.month === currentMonth())?.count || 0;
  const trackedDates = [...(history.data || []), ...(viewers.data || [])].map((r) => r.date).filter(Boolean).sort();
  const latestDataDate = trackedDates.length ? trackedDates[trackedDates.length - 1] : null;
  const alerts = evaluateAlerts({ summary: cs, growth, topVideo: topVideos[0], latestDataDate, contentThisMonth });

  return {
    summary: cs,
    growth,
    history: (history.data || []).map((r) => ({ date: r.date, followers: r.followers })),
    viewers: viewersRatio,
    bestHours,
    hashtags,
    gender: (gender.data || [])[0] || null,
    territories: (territories.data || []).slice(0, 6),
    topVideos,
    latestDataDate,
    alerts,
    insights: generateInsights({ summary: cs, growth, viewers: viewersRatio, bestHours, hashtags }),
  };
}
