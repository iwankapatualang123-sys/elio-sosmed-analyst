// File: test/tiktok-weekly.test.js
// Tes pemecahan bulan jadi tren mingguan (lib/tiktok/weekly.js). Jalankan: npm run test:weekly.

const { weekOfMonth, weeklyContentTrend, weeklyOverviewTrend, weeklyFollowerTrend } = require("../lib/tiktok/weekly.js");

let pass = 0;
let fail = 0;
function ok(name, cond) { if (cond) { pass += 1; console.log(`  ok  ${name}`); } else { fail += 1; console.log(`FAIL  ${name}`); } }
function eq(name, got, want) { ok(name, JSON.stringify(got) === JSON.stringify(want)); if (JSON.stringify(got) !== JSON.stringify(want)) console.log(`       got : ${JSON.stringify(got)}\n       want: ${JSON.stringify(want)}`); }

console.log("== weekOfMonth ==");
eq("hari 1 -> minggu 1", weekOfMonth(1), 1);
eq("hari 7 -> minggu 1", weekOfMonth(7), 1);
eq("hari 8 -> minggu 2", weekOfMonth(8), 2);
eq("hari 21 -> minggu 3", weekOfMonth(21), 3);
eq("hari 28 -> minggu 4", weekOfMonth(28), 4);
eq("hari 31 -> minggu 5", weekOfMonth(31), 5);

console.log("== weeklyContentTrend ==");
{
  const content = [
    { post_date: "2026-07-02", total_views: 100, total_likes: 10, total_comments: 2, total_shares: 1 },
    { post_date: "2026-07-05", total_views: 200, total_likes: 20, total_comments: 0, total_shares: 0 },
    { post_date: "2026-07-10", total_views: 50, total_likes: 5, total_comments: 0, total_shares: 0 },
    { post_date: "2026-07-31", total_views: 999, total_likes: 0, total_comments: 0, total_shares: 0 },
  ];
  const w = weeklyContentTrend(content);
  eq("4 minggu terisi (1,2,5)", w.map((x) => x.week), [1, 2, 5]);
  eq("minggu 1: 2 video, 300 views", [w[0].count, w[0].views], [2, 300]);
  eq("minggu 1 label", w[0].label, "Minggu 1");
  eq("minggu 1 engagement rate", w[0].engagementRate, Math.round((33 / 300) * 10000) / 100);
  eq("minggu 2: 1 video, 50 views", [w[1].count, w[1].views], [1, 50]);
}

console.log("== weeklyOverviewTrend ==");
{
  const overview = [
    { date: "2026-07-01", video_views: 10, profile_views: 1, likes: 1, comments: 0, shares: 0 },
    { date: "2026-07-08", video_views: 20, profile_views: 2, likes: 2, comments: 1, shares: 0 },
    { date: "2026-07-09", video_views: 30, profile_views: 3, likes: 3, comments: 0, shares: 1 },
  ];
  const w = weeklyOverviewTrend(overview);
  eq("2 minggu (1,2)", w.map((x) => x.week), [1, 2]);
  eq("minggu 2 gabung 2 hari", [w[1].videoViews, w[1].likes, w[1].comments], [50, 5, 1]);
}

console.log("== weeklyFollowerTrend (boleh negatif) ==");
{
  const history = [
    { date: "2026-07-01", followers: 100, diff_from_previous_day: 0 },
    { date: "2026-07-03", followers: 110, diff_from_previous_day: 10 },
    { date: "2026-07-09", followers: 105, diff_from_previous_day: -5 },
    { date: "2026-07-10", followers: 108, diff_from_previous_day: 3 },
  ];
  const w = weeklyFollowerTrend(history);
  eq("minggu 1 net +10, endFollowers 110", [w[0].netGrowth, w[0].endFollowers], [10, 110]);
  // Minggu 2 gabung 2 hari: -5 (9 Jul) + 3 (10 Jul) = -2 — total boleh negatif, tetap ditampilkan apa adanya.
  eq("minggu 2 net -2 (gabungan turun+naik)", w[1].netGrowth, -2);
  eq("urutan minggu naik", w.map((x) => x.week), [1, 2]);
}

console.log("== edge cases ==");
eq("array kosong -> array kosong", weeklyContentTrend([]), []);
eq("baris tanpa tanggal diabaikan", weeklyContentTrend([{ total_views: 5 }]), []);

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail === 0 ? 0 : 1);
