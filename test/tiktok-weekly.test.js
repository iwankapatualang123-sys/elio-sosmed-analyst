// File: test/tiktok-weekly.test.js
// Tes pemecahan bulan jadi tren mingguan (lib/tiktok/weekly.js). Jalankan: npm run test:weekly.

const { weekOfMonth, weeklyContentTrend, weeklyOverviewTrend, weeklyFollowerTrend, weeksInMonth, weeklyReport, weekDateRange, monthDateRange } = require("../lib/tiktok/weekly.js");

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
  // net = endFollowers minggu ini − minggu lalu (baseline=100). Minggu 1: 110-100=+10.
  eq("minggu 1 net +10, endFollowers 110", [w[0].netGrowth, w[0].endFollowers], [10, 110]);
  // Minggu 2 endFollowers 108, minggu lalu 110 -> 108-110 = -2.
  eq("minggu 2 net -2 (108-110), endFollowers 108", [w[1].netGrowth, w[1].endFollowers], [-2, 108]);
  eq("urutan minggu naik", w.map((x) => x.week), [1, 2]);
}

console.log("== weeklyFollowerTrend KONSISTENSI (net = selisih follower akhir, total cocok) ==");
{
  // Skenario nyata: minggu 1 KOSONG, data mulai minggu 2. Baseline = 8524 (data pertama).
  const history = [
    { date: "2026-06-11", followers: 8524, diff_from_previous_day: 3 },
    { date: "2026-06-14", followers: 8517, diff_from_previous_day: -2 }, // akhir minggu 2
    { date: "2026-06-18", followers: 8509, diff_from_previous_day: -1 }, // akhir minggu 3
    { date: "2026-06-25", followers: 8558, diff_from_previous_day: 4 },  // akhir minggu 4
    { date: "2026-06-30", followers: 8576, diff_from_previous_day: 6 },  // akhir minggu 5
  ];
  const w = weeklyFollowerTrend(history, { totalWeeks: 5 });
  eq("endFollowers per minggu", w.map((x) => x.endFollowers), [null, 8517, 8509, 8558, 8576]);
  // net = end - endMingguLalu; minggu 2 pakai baseline 8524.
  eq("net per minggu (selisih follower akhir)", w.map((x) => x.netGrowth), [0, 8517 - 8524, 8509 - 8517, 8558 - 8509, 8576 - 8558]);
  const totalNet = w.reduce((s, x) => s + x.netGrowth, 0);
  eq("JUMLAH net mingguan = pertumbuhan bulanan (8576-8524=52)", totalNet, 8576 - 8524);
  // Konsistensi: tiap minggu berdata, net == endFollowers - endFollowers minggu berdata sebelumnya.
  let prev = 8524;
  let konsisten = true;
  for (const x of w) { if (x.endFollowers != null) { if (x.netGrowth !== x.endFollowers - prev) konsisten = false; prev = x.endFollowers; } }
  ok("net selalu = follower akhir - follower akhir sebelumnya", konsisten);
}

console.log("== edge cases ==");
eq("array kosong -> array kosong", weeklyContentTrend([]), []);
eq("baris tanpa tanggal diabaikan", weeklyContentTrend([{ total_views: 5 }]), []);

console.log("== options.totalWeeks (isi minggu kosong, tidak melompat) ==");
{
  // Konten cuma ada di minggu 2 & 5, tapi bulan itu ada 5 minggu -> minggu 1,3,4 harus tetap muncul (0).
  const content = [
    { post_date: "2026-07-10", total_views: 50, total_likes: 5, total_comments: 0, total_shares: 0 },
    { post_date: "2026-07-31", total_views: 100, total_likes: 0, total_comments: 0, total_shares: 0 },
  ];
  const w = weeklyContentTrend(content, { totalWeeks: 5 });
  eq("5 minggu semua muncul", w.map((x) => x.week), [1, 2, 3, 4, 5]);
  eq("minggu 1 kosong -> 0", [w[0].count, w[0].views], [0, 0]);
  eq("minggu 1 tetap punya label", w[0].label, "Minggu 1");
  eq("minggu 2 tetap terisi data asli", [w[1].count, w[1].views], [1, 50]);
  eq("tanpa totalWeeks tetap perilaku lama (lompat)", weeklyContentTrend(content).map((x) => x.week), [2, 5]);
}
{
  // Follower: endFollowers minggu kosong harus mewarisi minggu terakhir yang ada data.
  const history = [
    { date: "2026-07-03", followers: 110, diff_from_previous_day: 10 },
    { date: "2026-07-25", followers: 130, diff_from_previous_day: 5 },
  ];
  const w = weeklyFollowerTrend(history, { totalWeeks: 5 });
  eq("5 minggu semua muncul", w.map((x) => x.week), [1, 2, 3, 4, 5]);
  eq("minggu 2 (kosong) warisi endFollowers dari minggu 1", w[1].endFollowers, 110);
  eq("minggu 3 (kosong) tetap warisi 110", w[2].endFollowers, 110);
  eq("minggu 4 terisi data asli -> 130", w[3].endFollowers, 130);
  eq("minggu 5 (kosong) warisi 130", w[4].endFollowers, 130);
  eq("minggu kosong netGrowth 0", w[1].netGrowth, 0);
}
{
  const overview = [{ date: "2026-07-08", video_views: 20, profile_views: 2, likes: 2, comments: 1, shares: 0 }];
  const w = weeklyOverviewTrend(overview, { totalWeeks: 4 });
  eq("4 minggu semua muncul", w.map((x) => x.week), [1, 2, 3, 4]);
  eq("minggu 1 kosong -> 0 semua field", [w[0].videoViews, w[0].likes, w[0].comments], [0, 0, 0]);
}

console.log("== weeksInMonth ==");
eq("Juli (31 hari) -> 5 minggu", weeksInMonth("2026-07"), 5);
eq("Februari (28 hari) -> 4 minggu", weeksInMonth("2026-02"), 4);
eq("Juni (30 hari) -> 5 minggu", weeksInMonth("2026-06"), 5);
eq("input invalid -> default 5", weeksInMonth("bukan-bulan"), 5);

console.log("== weeklyReport ==");
{
  const content = [
    { post_date: "2026-06-30", total_views: 999, total_likes: 0, total_comments: 0, total_shares: 0 }, // BULAN LAIN, harus dibuang
    { post_date: "2026-07-03", total_views: 100, total_likes: 10, total_comments: 0, total_shares: 0 },
    { post_date: "2026-07-10", total_views: 50, total_likes: 5, total_comments: 0, total_shares: 0 },
  ];
  const overview = [
    { date: "2026-06-15", video_views: 500, profile_views: 5, likes: 5, comments: 0, shares: 0 }, // BULAN LAIN
    { date: "2026-07-02", video_views: 200, profile_views: 20, likes: 10, comments: 1, shares: 2 },
  ];
  const history = [
    { date: "2026-07-01", followers: 100, diff_from_previous_day: 0 },
    { date: "2026-07-05", followers: 115, diff_from_previous_day: 15 },
  ];
  const r = weeklyReport({ content, overview, history }, "2026-07");
  eq("totalWeeks Juli = 5", r.totalWeeks, 5);
  eq("month tersimpan", r.month, "2026-07");
  eq("content: 5 minggu, buang bulan lain", r.content.map((x) => x.week), [1, 2, 3, 4, 5]);
  eq("content minggu 1 = 1 video 100 views (Jun dibuang)", [r.content[0].count, r.content[0].views], [1, 100]);
  eq("content minggu 2 = 1 video 50 views", [r.content[1].count, r.content[1].views], [1, 50]);
  eq("overview minggu 1 (Jun dibuang)", [r.overview[0].videoViews, r.overview[0].profileViews], [200, 20]);
  eq("follower minggu 1 net +15", r.follower[0].netGrowth, 15);
  eq("weeks: 5 entri dgn rentang tanggal", r.weeks.map((w) => w.rangeShort), ["1–7", "8–14", "15–21", "22–28", "29–31"]);
  eq("weeks[0] label & range lengkap", [r.weeks[0].label, r.weeks[0].rangeLabel, r.weeks[0].from, r.weeks[0].to], ["Minggu 1", "1–7 Jul", "2026-07-01", "2026-07-07"]);
}

console.log("== weekDateRange & monthDateRange ==");
eq("Juli minggu 1 -> 1–7", weekDateRange("2026-07", 1).rangeShort, "1–7");
eq("Juli minggu 5 -> 29–31 (akhir bulan)", weekDateRange("2026-07", 5).rangeShort, "29–31");
eq("Juni minggu 5 -> 29–30 (30 hari)", weekDateRange("2026-06", 5).rangeShort, "29–30");
eq("Februari minggu 5 -> null (tak ada)", weekDateRange("2026-02", 5), null);
eq("Februari minggu 4 -> 22–28", weekDateRange("2026-02", 4).rangeShort, "22–28");
eq("monthDateRange Juli", monthDateRange("2026-07").label, "1–31 Jul 2026");

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail === 0 ? 0 : 1);
