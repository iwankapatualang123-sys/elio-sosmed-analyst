// File: lib/tiktok/metrics.js
// Tujuan: perhitungan metrik & analisis KHUSUS TikTok dari baris data yang sudah
// diparse/diambil dari DB (engagement rate, ranking konten, analisis hashtag,
// pertumbuhan follower, rasio viewers, jam terbaik posting, benchmark & status
// naik/stabil/turun). Sesuai blueprint bagian 3, 4, 5, 9.
//
// Prinsip desain (blueprint bagian 16):
// - MURNI: tanpa jaringan/DB, input array baris -> output angka. Gampang dites.
// - Dipisah per platform (TikTok). Istilah metrik bisa beda dari platform lain.
// - Tahan data kotor: nilai null/negatif/undefined dianggap 0 lewat num().
//
// Bentuk baris mengikuti output lib/tiktok/parser.js (kolom tabel Supabase).
// Modul CommonJS.

// ---------------------------------------------------------------------------
// Helper dasar
// ---------------------------------------------------------------------------

// Fungsi: num — pastikan sebuah nilai jadi angka aman (null/NaN/undefined -> 0).
function num(v) {
  return typeof v === 'number' && !Number.isNaN(v) ? v : 0;
}

// Fungsi: round2 — bulatkan ke 2 desimal.
function round2(n) {
  return Math.round(n * 100) / 100;
}

// Fungsi: sumBy — jumlahkan hasil fn atas tiap elemen array.
function sumBy(arr, fn) {
  let s = 0;
  for (const x of arr) s += fn(x);
  return s;
}

// Ambang default status naik/stabil/turun (persen). Blueprint bagian 9 mencatat
// ambang resmi BELUM di-lock — nilai ini bisa di-override lewat parameter, dan
// perlu dikonfirmasi tim sebelum produksi.
const DEFAULT_STATUS_THRESHOLD_PCT = 5;

// ---------------------------------------------------------------------------
// Engagement & ringkasan konten
// ---------------------------------------------------------------------------

// Fungsi: videoEngagement
// Hitung total engagement & engagement rate satu video.
// Input: baris content. Output: { total_engagement, engagement_rate } (rate %).
// engagement_rate = (likes+comments+shares) / views * 100; kalau views 0 -> 0.
function videoEngagement(row) {
  const views = num(row.total_views);
  const engagement = num(row.total_likes) + num(row.total_comments) + num(row.total_shares);
  return {
    total_engagement: engagement,
    engagement_rate: views > 0 ? round2((engagement / views) * 100) : 0,
  };
}

// Fungsi: summarizeContent
// Ringkas metrik seluruh konten sebuah cabang untuk kartu dashboard (blueprint bagian 4).
// Input: array baris content. Output: objek ringkasan + array `videos` yang sudah
// diperkaya (engagement_rate, total_engagement).
// Catatan 2 definisi engagement rate:
//   - engagementRateOverall  = total engagement / total views (tertimbang) — dipakai
//     untuk KPI gabungan, tidak bias oleh video ber-views kecil.
//   - avgEngagementRatePerVideo = rata-rata engagement_rate antar video.
function summarizeContent(contentRows) {
  const videos = contentRows.map((r) => ({ ...r, ...videoEngagement(r) }));
  const n = videos.length;
  const totalViews = sumBy(videos, (v) => num(v.total_views));
  const totalLikes = sumBy(videos, (v) => num(v.total_likes));
  const totalComments = sumBy(videos, (v) => num(v.total_comments));
  const totalShares = sumBy(videos, (v) => num(v.total_shares));
  const totalEngagement = totalLikes + totalComments + totalShares;
  return {
    totalVideos: n,
    totalViews,
    totalLikes,
    totalComments,
    totalShares,
    totalEngagement,
    avgViewsPerPost: n ? Math.round(totalViews / n) : 0,
    engagementRateOverall: totalViews > 0 ? round2((totalEngagement / totalViews) * 100) : 0,
    avgEngagementRatePerVideo: n ? round2(sumBy(videos, (v) => v.engagement_rate) / n) : 0,
    videos,
  };
}

// Fungsi: rankVideos
// Urutkan/rangking video. Input: array video (idealnya sudah diperkaya lewat
// summarizeContent; kalau belum, engagement dihitung on the fly), options:
//   by    - 'views' | 'likes' | 'comments' | 'shares' | 'engagement_rate' | 'engagement'
//   order - 'desc' (default, top) | 'asc' (bottom)
//   limit - jumlah hasil (default semua)
// Output: array video terurut (salinan, input tidak diubah).
function rankVideos(videos, options = {}) {
  const by = options.by || 'engagement_rate';
  const order = options.order === 'asc' ? 'asc' : 'desc';
  const metricOf = (v) => {
    switch (by) {
      case 'views': return num(v.total_views);
      case 'likes': return num(v.total_likes);
      case 'comments': return num(v.total_comments);
      case 'shares': return num(v.total_shares);
      case 'engagement': return v.total_engagement != null ? num(v.total_engagement) : videoEngagement(v).total_engagement;
      case 'engagement_rate':
      default: return v.engagement_rate != null ? num(v.engagement_rate) : videoEngagement(v).engagement_rate;
    }
  };
  const sorted = [...videos].sort((a, b) => (order === 'asc' ? metricOf(a) - metricOf(b) : metricOf(b) - metricOf(a)));
  return options.limit ? sorted.slice(0, options.limit) : sorted;
}

// Fungsi: contentPerMonth
// Kelompokkan konten per bulan (dari post_date) — blueprint bagian 3 "total konten
// per bulan". Input: array content. Output: array { month:'YYYY-MM', count, totalViews }
// terurut menaik berdasarkan bulan. Baris tanpa post_date valid diabaikan.
function contentPerMonth(contentRows) {
  const map = new Map();
  for (const r of contentRows) {
    if (!r.post_date || typeof r.post_date !== 'string') continue;
    const month = r.post_date.slice(0, 7); // YYYY-MM
    const cur = map.get(month) || { month, count: 0, totalViews: 0 };
    cur.count += 1;
    cur.totalViews += num(r.total_views);
    map.set(month, cur);
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

// ---------------------------------------------------------------------------
// Analisis hashtag
// ---------------------------------------------------------------------------

// Fungsi: extractHashtags
// Ambil hashtag dari judul video. Input: string judul. Output: array hashtag
// huruf-kecil termasuk tanda '#' (mis. ["#fyp", "#malang"]).
function extractHashtags(title) {
  const matches = String(title == null ? '' : title).match(/#[\p{L}\p{N}_]+/gu) || [];
  return matches.map((h) => h.toLowerCase());
}

// Fungsi: hashtagStats
// Agregasi performa per hashtag (blueprint bagian 3 & 21A). Tiap hashtag dihitung
// sekali per video (unik per video). Input: array content, options.limit.
// Output: array { hashtag, count, totalViews, totalEngagement, avgViews,
// avgEngagementRate } terurut by count lalu totalViews.
function hashtagStats(contentRows, options = {}) {
  const map = new Map();
  for (const r of contentRows) {
    const views = num(r.total_views);
    const engagement = num(r.total_likes) + num(r.total_comments) + num(r.total_shares);
    const tags = new Set(extractHashtags(r.video_title));
    for (const tag of tags) {
      const cur = map.get(tag) || { hashtag: tag, count: 0, totalViews: 0, totalEngagement: 0 };
      cur.count += 1;
      cur.totalViews += views;
      cur.totalEngagement += engagement;
      map.set(tag, cur);
    }
  }
  let arr = [...map.values()].map((h) => ({
    ...h,
    avgViews: h.count ? Math.round(h.totalViews / h.count) : 0,
    avgEngagementRate: h.totalViews > 0 ? round2((h.totalEngagement / h.totalViews) * 100) : 0,
  }));
  arr.sort((a, b) => b.count - a.count || b.totalViews - a.totalViews);
  if (options.limit) arr = arr.slice(0, options.limit);
  return arr;
}

// ---------------------------------------------------------------------------
// Follower & viewers
// ---------------------------------------------------------------------------

// Fungsi: followerGrowth
// Ringkas pertumbuhan follower sepanjang periode (blueprint bagian 3 & 4).
// Input: array follower_history. Output: { startDate, endDate, startFollowers,
// endFollowers, netGrowth, gained, lost, bestDay, worstDay, days }.
// netGrowth pakai selisih akhir-awal (bukan menjumlah diff, hindari salah hitung
// kalau ada tumpang tindih). gained/lost & best/worst dari diff_from_previous_day.
function followerGrowth(historyRows) {
  const rows = [...historyRows].filter((r) => r.date).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (rows.length === 0) {
    return { startDate: null, endDate: null, startFollowers: 0, endFollowers: 0, netGrowth: 0, gained: 0, lost: 0, bestDay: null, worstDay: null, days: 0 };
  }
  const first = rows[0];
  const last = rows[rows.length - 1];
  let gained = 0;
  let lost = 0;
  let bestDay = null;
  let worstDay = null;
  for (const r of rows) {
    const d = num(r.diff_from_previous_day);
    if (d > 0) gained += d;
    else if (d < 0) lost += Math.abs(d);
    if (bestDay === null || d > bestDay.diff) bestDay = { date: r.date, diff: d };
    if (worstDay === null || d < worstDay.diff) worstDay = { date: r.date, diff: d };
  }
  return {
    startDate: first.date,
    endDate: last.date,
    startFollowers: num(first.followers),
    endFollowers: num(last.followers),
    netGrowth: num(last.followers) - num(first.followers),
    gained,
    lost,
    bestDay,
    worstDay,
    days: rows.length,
  };
}

// Fungsi: viewersRatio
// Rasio new vs returning viewers (blueprint bagian 3). Baris is_incomplete (hari
// belum lengkap) DIKECUALIKAN dari total supaya tidak bias. Input: array viewers.
// Output: { totalNew, totalReturning, totalViewers, newPct, returningPct,
// daysCounted, daysIncomplete }.
function viewersRatio(viewersRows) {
  const valid = viewersRows.filter((r) => !r.is_incomplete);
  const totalNew = sumBy(valid, (r) => num(r.new_viewers));
  const totalReturning = sumBy(valid, (r) => num(r.returning_viewers));
  const base = totalNew + totalReturning;
  return {
    totalNew,
    totalReturning,
    totalViewers: sumBy(valid, (r) => num(r.total_viewers)),
    newPct: base > 0 ? round2((totalNew / base) * 100) : 0,
    returningPct: base > 0 ? round2((totalReturning / base) * 100) : 0,
    daysCounted: valid.length,
    daysIncomplete: viewersRows.length - valid.length,
  };
}

// ---------------------------------------------------------------------------
// Jam terbaik posting (dari follower_activity)
// ---------------------------------------------------------------------------

// Fungsi: bestPostingTimes
// Hitung jam paling ramai follower dari data aktivitas per jam (blueprint bagian
// 3 & 21A). Input: array follower_activity, options.top (default 3).
// Output: { byHour: [{hour, totalActive, avgActive, days}] (24 entri, terurut jam),
//   topHours: [...top by avgActive], heatmap: { [weekday 0-6]: { [hour]: avgActive } } }.
// weekday: 0=Minggu..6=Sabtu (pakai UTC agar konsisten lintas zona waktu).
function bestPostingTimes(activityRows, options = {}) {
  const top = options.top || 3;
  const hourAgg = Array.from({ length: 24 }, (_, h) => ({ hour: h, totalActive: 0, days: 0 }));
  const heatSum = {}; // weekday -> hour -> { sum, days }
  for (const r of activityRows) {
    const h = num(r.hour);
    if (h < 0 || h > 23) continue;
    const active = num(r.active_followers);
    hourAgg[h].totalActive += active;
    hourAgg[h].days += 1;
    if (r.date) {
      const wd = new Date(`${r.date}T00:00:00Z`).getUTCDay();
      if (!Number.isNaN(wd)) {
        heatSum[wd] = heatSum[wd] || {};
        heatSum[wd][h] = heatSum[wd][h] || { sum: 0, days: 0 };
        heatSum[wd][h].sum += active;
        heatSum[wd][h].days += 1;
      }
    }
  }
  const byHour = hourAgg.map((x) => ({
    hour: x.hour,
    totalActive: x.totalActive,
    avgActive: x.days ? round2(x.totalActive / x.days) : 0,
    days: x.days,
  }));
  const topHours = [...byHour].sort((a, b) => b.avgActive - a.avgActive).slice(0, top);
  const heatmap = {};
  for (const wd of Object.keys(heatSum)) {
    heatmap[wd] = {};
    for (const h of Object.keys(heatSum[wd])) {
      const cell = heatSum[wd][h];
      heatmap[wd][h] = cell.days ? round2(cell.sum / cell.days) : 0;
    }
  }
  return { byHour, topHours, heatmap };
}

// ---------------------------------------------------------------------------
// Benchmark & status (periode ini vs sebelumnya)
// ---------------------------------------------------------------------------

// Fungsi: statusFromDelta
// Tentukan status naik/stabil/turun dari persentase perubahan. Input: deltaPct,
// thresholdPct (default 5). Output: 'naik' | 'stabil' | 'turun'.
function statusFromDelta(deltaPct, thresholdPct = DEFAULT_STATUS_THRESHOLD_PCT) {
  if (deltaPct > thresholdPct) return 'naik';
  if (deltaPct < -thresholdPct) return 'turun';
  return 'stabil';
}

// Fungsi: benchmark
// Bandingkan nilai periode ini vs periode sebelumnya (blueprint bagian 4 & 9).
// Input: current, previous, options.thresholdPct. Output: { current, previous,
// deltaAbs, deltaPct, status }.
// deltaPct: kalau previous 0, dianggap +100% bila current>0, else 0%.
function benchmark(current, previous, options = {}) {
  const c = num(current);
  const p = num(previous);
  const deltaAbs = c - p;
  const deltaPct = p !== 0 ? round2((deltaAbs / p) * 100) : (c > 0 ? 100 : 0);
  return {
    current: c,
    previous: p,
    deltaAbs,
    deltaPct,
    status: statusFromDelta(deltaPct, options.thresholdPct),
  };
}

// ---------------------------------------------------------------------------
// Ringkasan KPI cabang (untuk kartu dashboard, blueprint bagian 4)
// ---------------------------------------------------------------------------

// Fungsi: accountSummary
// Rangkum KPI utama satu cabang dari beberapa sumber data. Input: objek berisi
// array { content, followerHistory, viewers }. Output: objek KPI siap tampil di kartu.
function accountSummary({ content = [], followerHistory = [], viewers = [] } = {}) {
  const c = summarizeContent(content);
  const fg = followerGrowth(followerHistory);
  const vr = viewersRatio(viewers);
  return {
    totalVideos: c.totalVideos,
    totalViews: c.totalViews,
    avgViewsPerPost: c.avgViewsPerPost,
    engagementRate: c.engagementRateOverall,
    netFollowerGrowth: fg.netGrowth,
    endFollowers: fg.endFollowers,
    newViewersPct: vr.newPct,
    returningViewersPct: vr.returningPct,
  };
}

module.exports = {
  // helper
  num,
  round2,
  DEFAULT_STATUS_THRESHOLD_PCT,
  // konten & engagement
  videoEngagement,
  summarizeContent,
  rankVideos,
  contentPerMonth,
  // hashtag
  extractHashtags,
  hashtagStats,
  // follower & viewers
  followerGrowth,
  viewersRatio,
  // waktu
  bestPostingTimes,
  // benchmark
  statusFromDelta,
  benchmark,
  // ringkasan
  accountSummary,
};
