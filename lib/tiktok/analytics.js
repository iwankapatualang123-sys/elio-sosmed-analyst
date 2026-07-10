// File: lib/tiktok/analytics.js
// Tujuan: memuat data TikTok dari Supabase lalu menghitung metrik (via metrics.js)
// untuk dashboard. Menerima client Supabase terikat sesi (RLS berlaku).
// Modul ESM (dipakai Server Component). metrics.js (CJS) diimpor sebagai default.
//
// Filter BULAN (blueprint 21A — evaluasi kinerja tim per bulan): loadPortfolio &
// loadBranchDetail menerima options.month ('YYYY-MM'). Tanpa month (undefined/null)
// = PERSIS perilaku lama (semua data sepanjang masa) — supaya tidak ada regresi.
// Metrik yang TIDAK ikut discope oleh month (sengaja tetap all-time/terkini):
// - Target & Progress (target itu tujuan berjalan, bukan reset tiap bulan) -> field `allTime`.
// - Alerts & latestDataDate (peringatan kesehatan akun "saat ini", bukan cerita bulan lama).
// - Forecast 7 hari (meramal ke depan tidak masuk akal saat sedang meninjau bulan lampau).

import metrics from "./metrics.js";
import { generateInsights } from "./insights.js";
import { evaluateAlerts } from "./alerts.js";
import { weeklyReport } from "./weekly.js";

// Fungsi: currentMonth — string 'YYYY-MM' bulan berjalan (UTC).
function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

// Fungsi: monthOf — 'YYYY-MM' dari sebuah tanggal 'YYYY-MM-DD', atau null.
function monthOf(d) {
  return typeof d === "string" ? d.slice(0, 7) : null;
}

// Fungsi: inMonth — true kalau `month` kosong (tidak discope) ATAU tanggal `d` ada di bulan itu.
function inMonth(d, month) {
  return !month || monthOf(d) === month;
}

// Fungsi: endOfMonth — tanggal terakhir 'YYYY-MM-DD' dari sebuah bulan 'YYYY-MM'.
function endOfMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  return `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
}

// Fungsi: pickSnapshot
// Data gender/lokasi follower adalah SNAPSHOT (potret sesaat, bisa banyak tanggal
// seiring waktu). Pilih snapshot yang tepat untuk periode yang diminta: kalau month
// diisi, ambil snapshot TERAKHIR yang <= akhir bulan itu (supaya tidak "bocor" data
// dari masa depan saat meninjau bulan lampau); kalau month kosong, ambil yang paling
// baru dari semua. Tidak ketemu -> null.
// Input: rows (punya kolom dateKey), dateKey nama kolom tanggal, month 'YYYY-MM'|null.
// Output: { date, rows: [...baris dgn tanggal itu] } | null.
function pickSnapshot(rows, dateKey, month) {
  const dates = [...new Set(rows.map((r) => r[dateKey]).filter(Boolean))].sort();
  const eligible = month ? dates.filter((d) => d <= endOfMonth(month)) : dates;
  const target = eligible.length ? eligible[eligible.length - 1] : null;
  if (!target) return null;
  return { date: target, rows: rows.filter((r) => r[dateKey] === target) };
}

// Fungsi: loadPortfolio
// Ringkasan lintas cabang untuk KPI + tabel ranking (blueprint bagian 4).
// Input: supabase client, options.month ('YYYY-MM', opsional — scope ke 1 bulan).
// Output (async): { branches:[summaryPerCabang], portfolio:{KPI}, months:[tersedia] }.
export async function loadPortfolio(supabase, options = {}) {
  const month = options.month || null;
  const { data: accounts } = await supabase
    .from("tiktok_accounts")
    .select("id, nama_cabang, tiktok_username, kategori")
    .eq("is_active", true)
    .order("nama_cabang");
  const branches = [];
  const monthSet = new Set();
  for (const acc of accounts || []) {
    const [{ data: content }, { data: history }] = await Promise.all([
      supabase.from("tiktok_content").select("*").eq("tiktok_account_id", acc.id),
      supabase.from("tiktok_follower_history").select("*").eq("tiktok_account_id", acc.id),
    ]);
    (content || []).forEach((r) => r.post_date && monthSet.add(monthOf(r.post_date)));
    (history || []).forEach((r) => r.date && monthSet.add(monthOf(r.date)));

    const scopedContent = (content || []).filter((r) => inMonth(r.post_date, month));
    const scopedHistory = (history || []).filter((r) => inMonth(r.date, month));
    const cs = metrics.summarizeContent(scopedContent);
    const fg = metrics.followerGrowth(scopedHistory);
    // "Konten bulan ini": kalau lagi meninjau 1 bulan spesifik, itu = jumlah konten
    // bulan tsb (sudah = cs.totalVideos). Tanpa filter, tetap bulan KALENDER berjalan
    // (perilaku asli, dipakai widget "sekarang").
    const contentThisMonth = month
      ? cs.totalVideos
      : metrics.contentPerMonth(content || []).find((m) => m.month === currentMonth())?.count || 0;
    branches.push({
      id: acc.id,
      nama_cabang: acc.nama_cabang,
      tiktok_username: acc.tiktok_username,
      kategori: acc.kategori || null,
      totalContent: cs.totalVideos,
      contentThisMonth,
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
  const months = [...monthSet].filter(Boolean).sort().reverse();
  return { branches, portfolio, months };
}

// Fungsi: loadBranchDetail
// Metrik lengkap satu cabang untuk grafik detail (tren follower, gender, lokasi,
// viewers, jam terbaik, top video). Input: supabase, accountId, options.month
// ('YYYY-MM', opsional — scope sebagian besar metrik ke 1 bulan; lihat catatan di
// atas file utk daftar yang SENGAJA tetap all-time).
// Output (async): objek detail, atau null kalau cabang tidak ada/akses ditolak.
export async function loadBranchDetail(supabase, accountId, options = {}) {
  if (!accountId) return null;
  const month = options.month || null;
  const [content, history, viewers, activity, gender, territories, overview] = await Promise.all([
    supabase.from("tiktok_content").select("*").eq("tiktok_account_id", accountId),
    supabase.from("tiktok_follower_history").select("*").eq("tiktok_account_id", accountId).order("date"),
    supabase.from("tiktok_viewers").select("*").eq("tiktok_account_id", accountId),
    supabase.from("tiktok_follower_activity").select("*").eq("tiktok_account_id", accountId),
    supabase.from("tiktok_follower_gender").select("*").eq("tiktok_account_id", accountId),
    supabase.from("tiktok_follower_territories").select("*").eq("tiktok_account_id", accountId),
    supabase.from("tiktok_daily_overview").select("date, video_views, profile_views, likes, comments, shares").eq("tiktok_account_id", accountId),
  ]);

  const contentRows = content.data || [];
  const historyRows = history.data || [];
  const viewersRows = viewers.data || [];
  const activityRows = activity.data || [];
  const overviewRows = overview.data || [];

  // --- Metrik SCOPED (ikut filter bulan kalau diisi) ---
  const scopedContent = contentRows.filter((r) => inMonth(r.post_date, month));
  const scopedHistory = historyRows.filter((r) => inMonth(r.date, month));
  const scopedViewers = viewersRows.filter((r) => inMonth(r.date, month));

  const cs = metrics.summarizeContent(scopedContent);
  const growth = metrics.followerGrowth(scopedHistory);
  const viewersRatio = metrics.viewersRatio(scopedViewers);
  const hashtags = metrics.hashtagStats(scopedContent, { limit: 8 });
  const topVideos = metrics.rankVideos(cs.videos, { by: "views", limit: 5 });

  // Aktivitas follower per jam (Jam Terbaik & Heatmap): export TikTok cuma menyimpan
  // JENDELA 7 HARI TERAKHIR — bukan deret waktu per-bulan. Kalau difilter ketat ke
  // bulan lampau, hampir selalu kosong -> grafik "0 semua" yang membingungkan. Jadi
  // SELALU pakai seluruh jendela aktivitas yang tersedia (yang terbaru), lalu beri
  // label rentang tanggalnya di UI supaya jelas ini "7 hari terakhir", bukan bulan itu.
  const bestHours = metrics.bestPostingTimes(activityRows, { top: 5 });
  const bestDayHour = metrics.heatmapPeak(bestHours.heatmap); // hari + jam paling ramai
  const activityDates = activityRows.map((r) => r.date).filter(Boolean).sort();
  const activityRange = activityDates.length ? { from: activityDates[0], to: activityDates[activityDates.length - 1] } : null;

  // Gender/lokasi: snapshot sesaat, bukan deret waktu — pilih snapshot yang valid
  // utk periode ini (lihat pickSnapshot), bukan sekadar "yang terbaru" kalau sedang
  // meninjau bulan lampau (supaya tidak nampilkan data dari masa depan periode itu).
  const genderSnap = pickSnapshot(gender.data || [], "snapshot_date", month);
  const territorySnap = pickSnapshot(territories.data || [], "snapshot_date", month);
  const genderRow = genderSnap ? genderSnap.rows[0] : null;
  const territoryRows = territorySnap
    ? [...territorySnap.rows].sort((a, b) => (b.distribution_pct || 0) - (a.distribution_pct || 0)).slice(0, 6)
    : [];

  // --- Metrik ALL-TIME (SENGAJA tidak ikut filter bulan) ---
  // Dipakai Target & Progress (target = tujuan berjalan, bukan reset tiap bulan) dan
  // Peringatan/Alert (kesehatan akun "saat ini", bukan cerita bulan yang sedang ditinjau).
  const csAllTime = month ? metrics.summarizeContent(contentRows) : cs;
  const growthAllTime = month ? metrics.followerGrowth(historyRows) : growth;
  const topVideoAllTime = month ? metrics.rankVideos(csAllTime.videos, { by: "views", limit: 1 })[0] : topVideos[0];
  const contentThisRealMonth = metrics.contentPerMonth(contentRows).find((m) => m.month === currentMonth())?.count || 0;
  const trackedDates = [...historyRows, ...viewersRows].map((r) => r.date).filter(Boolean).sort();
  const latestDataDate = trackedDates.length ? trackedDates[trackedDates.length - 1] : null;
  const alerts = evaluateAlerts({ summary: csAllTime, growth: growthAllTime, topVideo: topVideoAllTime, latestDataDate, contentThisMonth: contentThisRealMonth });

  return {
    isMonthScoped: !!month,
    selectedMonth: month,
    summary: cs,
    growth,
    history: scopedHistory.map((r) => ({ date: r.date, followers: r.followers })),
    viewers: viewersRatio,
    bestHours,
    bestDayHour,
    activityRange,
    hashtags,
    gender: genderRow,
    genderSnapshotDate: genderSnap?.date || null,
    territories: territoryRows,
    territorySnapshotDate: territorySnap?.date || null,
    topVideos,
    latestDataDate,
    alerts,
    insights: generateInsights({ summary: cs, growth, viewers: viewersRatio, bestHours, hashtags }),
    allTime: { summary: csAllTime, growth: growthAllTime },
    // Rincian mingguan (Minggu 1-5) — hanya dihitung kalau sedang meninjau 1 bulan
    // spesifik (mingguan lintas bulan tidak bermakna: hari-5-Jun & hari-5-Jul ketumpuk).
    weekly: month ? weeklyReport({ content: contentRows, overview: overviewRows, history: historyRows }, month) : null,
    months: [...new Set([...contentRows.map((r) => monthOf(r.post_date)), ...historyRows.map((r) => monthOf(r.date))].filter(Boolean))].sort().reverse(),
  };
}
