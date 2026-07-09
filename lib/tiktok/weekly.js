// File: lib/tiktok/weekly.js
// Tujuan: pecah data BULANAN jadi tren MINGGUAN (blueprint bagian 21A —
// "perbandingan periode fleksibel"). Selama ini filter cuma per-bulan; modul ini
// membagi bulan terpilih jadi Minggu 1-5 (hari 1-7, 8-14, 15-21, 22-28, 29-31)
// supaya kelihatan naik/turun DALAM sebulan, bukan cuma total bulanan.
//
// Input tiap fungsi: array baris yang SUDAH difilter ke satu bulan (mis. hasil
// filter selectedMonth di app/data/page.jsx) — modul ini tidak perlu tahu bulan
// apa, cukup kelompokkan berdasarkan tanggal (nomor hari) yang ada.
// Murni, tanpa jaringan — mudah dites.

// Fungsi: weekOfMonth — nomor minggu (1-5) dari nomor hari dalam bulan.
// Hari 1-7 -> Minggu 1, 8-14 -> Minggu 2, 15-21 -> Minggu 3, 22-28 -> Minggu 4,
// 29-31 -> Minggu 5 (bisa cuma 1-3 hari, tetap ditampilkan sebagai minggu terpisah).
export function weekOfMonth(day) {
  return Math.min(5, Math.ceil(Number(day) / 7));
}

// Fungsi: dayOfMonth — ambil nomor hari (1-31) dari string tanggal 'YYYY-MM-DD'.
function dayOfMonth(dateStr) {
  return Number(String(dateStr).slice(8, 10));
}

// Fungsi: weeklyContentTrend
// Input: array tiktok_content (post_date, total_views, total_likes, total_comments,
// total_shares) — idealnya sudah difilter ke 1 bulan.
// Output: array { week, label, count, views, engagement, engagementRate } terurut minggu.
export function weeklyContentTrend(contentRows = []) {
  const buckets = new Map();
  for (const r of contentRows) {
    if (!r.post_date) continue;
    const week = weekOfMonth(dayOfMonth(r.post_date));
    const b = buckets.get(week) || { week, count: 0, views: 0, engagement: 0 };
    b.count += 1;
    b.views += Number(r.total_views) || 0;
    b.engagement += (Number(r.total_likes) || 0) + (Number(r.total_comments) || 0) + (Number(r.total_shares) || 0);
    buckets.set(week, b);
  }
  return [...buckets.values()].sort((a, b) => a.week - b.week).map((b) => ({
    ...b,
    label: `Minggu ${b.week}`,
    engagementRate: b.views > 0 ? Math.round((b.engagement / b.views) * 10000) / 100 : 0,
  }));
}

// Fungsi: weeklyOverviewTrend
// Input: array tiktok_daily_overview (date, video_views, profile_views, likes,
// comments, shares) — idealnya sudah difilter ke 1 bulan.
// Output: array { week, label, videoViews, profileViews, likes, comments, shares }.
export function weeklyOverviewTrend(overviewRows = []) {
  const buckets = new Map();
  for (const r of overviewRows) {
    if (!r.date) continue;
    const week = weekOfMonth(dayOfMonth(r.date));
    const b = buckets.get(week) || { week, videoViews: 0, profileViews: 0, likes: 0, comments: 0, shares: 0 };
    b.videoViews += Number(r.video_views) || 0;
    b.profileViews += Number(r.profile_views) || 0;
    b.likes += Number(r.likes) || 0;
    b.comments += Number(r.comments) || 0;
    b.shares += Number(r.shares) || 0;
    buckets.set(week, b);
  }
  return [...buckets.values()].sort((a, b) => a.week - b.week).map((b) => ({ ...b, label: `Minggu ${b.week}` }));
}

// Fungsi: weeklyFollowerTrend
// Input: array tiktok_follower_history (date, followers, diff_from_previous_day)
// — idealnya sudah difilter ke 1 bulan. netGrowth boleh negatif (follower turun).
// Output: array { week, label, netGrowth, endFollowers } terurut minggu.
export function weeklyFollowerTrend(historyRows = []) {
  const rows = [...historyRows].filter((r) => r.date).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const buckets = new Map();
  for (const r of rows) {
    const week = weekOfMonth(dayOfMonth(r.date));
    const b = buckets.get(week) || { week, netGrowth: 0, endFollowers: null };
    b.netGrowth += Number(r.diff_from_previous_day) || 0;
    b.endFollowers = Number(r.followers);
    buckets.set(week, b);
  }
  return [...buckets.values()].sort((a, b) => a.week - b.week).map((b) => ({ ...b, label: `Minggu ${b.week}` }));
}
