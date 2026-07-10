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

// Fungsi: fillMissingWeeks
// Sisipkan minggu yang TIDAK punya data (mis. belum ada video/overview di minggu
// itu) sebagai baris kosong (nilai dari `emptyRow(week)`), supaya grafik/tabel tidak
// diam-diam "melompat" minggu — kalau lompat, orang bingung minggu itu ke mana
// (padahal cuma belum ada data, bukan error). Tanpa `totalWeeks`, perilaku lama
// dipertahankan (hanya minggu yang ada datanya yang muncul) — dipakai test lama.
// Input: list terurut (hasil bucket), totalWeeks (jumlah minggu di bulan itu,
// biasanya 4-5), emptyRow(week) -> objek baris kosong. Output: list length totalWeeks.
function fillMissingWeeks(list, totalWeeks, emptyRow) {
  if (!totalWeeks) return list;
  const byWeek = new Map(list.map((r) => [r.week, r]));
  const out = [];
  for (let week = 1; week <= totalWeeks; week += 1) {
    out.push(byWeek.get(week) || { ...emptyRow(week), week, label: `Minggu ${week}` });
  }
  return out;
}

// Fungsi: weeklyContentTrend
// Input: array tiktok_content (post_date, total_views, total_likes, total_comments,
// total_shares) — idealnya sudah difilter ke 1 bulan. options.totalWeeks (opsional):
// kalau diisi, minggu tanpa konten tetap muncul sbg baris 0 (bukan hilang dari list) —
// lihat fillMissingWeeks.
// Output: array { week, label, count, views, engagement, engagementRate } terurut minggu.
export function weeklyContentTrend(contentRows = [], options = {}) {
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
  const list = [...buckets.values()].sort((a, b) => a.week - b.week).map((b) => ({
    ...b,
    label: `Minggu ${b.week}`,
    engagementRate: b.views > 0 ? Math.round((b.engagement / b.views) * 10000) / 100 : 0,
  }));
  return fillMissingWeeks(list, options.totalWeeks, () => ({ count: 0, views: 0, engagement: 0, engagementRate: 0 }));
}

// Fungsi: weeklyOverviewTrend
// Input: array tiktok_daily_overview (date, video_views, profile_views, likes,
// comments, shares) — idealnya sudah difilter ke 1 bulan. options.totalWeeks: lihat
// weeklyContentTrend.
// Output: array { week, label, videoViews, profileViews, likes, comments, shares }.
export function weeklyOverviewTrend(overviewRows = [], options = {}) {
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
  const list = [...buckets.values()].sort((a, b) => a.week - b.week).map((b) => ({ ...b, label: `Minggu ${b.week}` }));
  return fillMissingWeeks(list, options.totalWeeks, () => ({ videoViews: 0, profileViews: 0, likes: 0, comments: 0, shares: 0 }));
}

// Fungsi: weeklyFollowerTrend
// Input: array tiktok_follower_history (date, followers, diff_from_previous_day)
// — idealnya sudah difilter ke 1 bulan. netGrowth boleh negatif (follower turun).
// options.totalWeeks: lihat weeklyContentTrend — minggu kosong netGrowth=0 dan
// endFollowers DIWARISKAN dari minggu terakhir yang ada datanya (bukan null),
// karena follower adalah "keadaan" (state) bukan aktivitas — jumlahnya tidak
// benar-benar kosong di minggu tanpa data, cuma tidak berubah.
// Output: array { week, label, netGrowth, endFollowers } terurut minggu.
export function weeklyFollowerTrend(historyRows = [], options = {}) {
  const rows = [...historyRows].filter((r) => r.date).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const buckets = new Map();
  for (const r of rows) {
    const week = weekOfMonth(dayOfMonth(r.date));
    const b = buckets.get(week) || { week, netGrowth: 0, endFollowers: null };
    b.netGrowth += Number(r.diff_from_previous_day) || 0;
    b.endFollowers = Number(r.followers);
    buckets.set(week, b);
  }
  const list = [...buckets.values()].sort((a, b) => a.week - b.week).map((b) => ({ ...b, label: `Minggu ${b.week}` }));
  const filled = fillMissingWeeks(list, options.totalWeeks, () => ({ netGrowth: 0, endFollowers: null }));
  // Warisi endFollowers ke minggu kosong dari minggu terakhir yang ada datanya.
  let lastKnown = null;
  return filled.map((w) => {
    if (w.endFollowers == null) return { ...w, endFollowers: lastKnown };
    lastKnown = w.endFollowers;
    return w;
  });
}

// Fungsi: weeksInMonth — jumlah minggu (1-5) dalam sebuah bulan 'YYYY-MM'. Dipakai
// sebagai totalWeeks supaya minggu tanpa data tetap muncul (Feb -> 4, lainnya -> 5).
export function weeksInMonth(ym) {
  if (!/^\d{4}-\d{2}$/.test(String(ym))) return 5;
  const [y, m] = String(ym).split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate(); // hari terakhir bulan itu
  return weekOfMonth(lastDay);
}

const BULAN_SINGKAT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

// Fungsi: weekDateRange — rentang tanggal sebuah minggu dalam bulan 'YYYY-MM'.
// Minggu 1 = tgl 1–7, 2 = 8–14, 3 = 15–21, 4 = 22–28, 5 = 29–akhir bulan.
// Output: { from, to (ISO 'YYYY-MM-DD'), rangeShort ("1–7"), rangeLabel ("1–7 Jul") }
// atau null kalau minggu itu di luar bulan (mis. Feb tidak punya minggu 5).
export function weekDateRange(month, week) {
  if (!/^\d{4}-\d{2}$/.test(String(month))) return null;
  const [y, m] = String(month).split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const startDay = (Number(week) - 1) * 7 + 1;
  if (startDay > lastDay) return null;
  const endDay = Number(week) >= 5 ? lastDay : Math.min(Number(week) * 7, lastDay);
  const pad = (n) => String(n).padStart(2, "0");
  const mon = BULAN_SINGKAT[m - 1] || m;
  return {
    from: `${month}-${pad(startDay)}`,
    to: `${month}-${pad(endDay)}`,
    rangeShort: `${startDay}–${endDay}`,
    rangeLabel: `${startDay}–${endDay} ${mon}`,
  };
}

// Fungsi: monthDateRange — rentang tanggal SELURUH bulan (tgl 1–akhir). Untuk header
// laporan mingguan ("1–31 Jul"). Output { from, to, label } atau null.
export function monthDateRange(month) {
  if (!/^\d{4}-\d{2}$/.test(String(month))) return null;
  const [y, m] = String(month).split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const mon = BULAN_SINGKAT[m - 1] || m;
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}`, label: `1–${lastDay} ${mon} ${y}` };
}

// Helper internal: baris ini masuk bulan `month`? (month kosong = semua lolos).
function rowInMonth(dateStr, month) {
  return !month || String(dateStr || "").slice(0, 7) === month;
}

// Fungsi: weeklyReport
// Rangkum SEMUA aspek mingguan (konten, overview, follower) untuk satu bulan dalam
// satu objek siap pakai (halaman laporan & export Excel). Baris difilter ke `month`
// di dalam sini, jadi pemanggil boleh mengoper array mentah (belum difilter).
// Input: { content, overview, history }, month 'YYYY-MM'.
// Output: { month, totalWeeks, content:[...], overview:[...], follower:[...] }.
export function weeklyReport({ content = [], overview = [], history = [] } = {}, month) {
  const totalWeeks = weeksInMonth(month);
  // Meta rentang tanggal tiap minggu (utk label "1–7 Jul", bukan cuma "Minggu 1").
  const weeks = [];
  for (let w = 1; w <= totalWeeks; w += 1) {
    weeks.push({ week: w, label: `Minggu ${w}`, ...(weekDateRange(month, w) || {}) });
  }
  return {
    month: month || null,
    totalWeeks,
    weeks,
    content: weeklyContentTrend(content.filter((r) => rowInMonth(r.post_date, month)), { totalWeeks }),
    overview: weeklyOverviewTrend(overview.filter((r) => rowInMonth(r.date, month)), { totalWeeks }),
    follower: weeklyFollowerTrend(history.filter((r) => rowInMonth(r.date, month)), { totalWeeks }),
  };
}
