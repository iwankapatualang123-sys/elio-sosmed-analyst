// File: test/instagram-metrics.test.js
// Tes agregasi data Instagram (lib/instagram/metrics.js). Jalankan: npm run test:ig-metrics

const {
  sumDaily, dailySeries, interactionsOf, erOf, contentInPeriod, isReel,
  topContents, accountEr, contentSummary, availableMonths, cumulativeFollowerSeries,
  contentTypeBreakdown, hashtagStats, postTypeShort,
} = require("../lib/instagram/metrics.js");

let pass = 0;
let fail = 0;
function ok(name, cond) { if (cond) { pass += 1; console.log(`  ok  ${name}`); } else { fail += 1; console.log(`FAIL  ${name}`); } }

const daily = [
  { metric: "views", date: "2026-06-29", value: 1000 },
  { metric: "views", date: "2026-06-30", value: 500 },
  { metric: "views", date: "2026-07-01", value: 200 },
  { metric: "reach", date: "2026-06-29", value: 700 },
  { metric: "new_followers", date: "2026-06-30", value: 12 },
];

// --- sumDaily ---
const juni = sumDaily(daily, "2026-06");
ok("sumDaily scope bulan", juni.views === 1500 && juni.reach === 700 && juni.new_followers === 12);
ok("sumDaily metrik tanpa data -> null (bukan 0)", juni.profile_visits === null);
ok("sumDaily hitung hari unik", juni.days === 2);
ok("sumDaily semua bulan", sumDaily(daily).views === 1700);

// --- dailySeries ---
const seri = dailySeries(daily, "views", "2026-06");
ok("dailySeries urut & terfilter", seri.length === 2 && seri[0].date === "2026-06-29" && seri[1].value === 500);

const contents = [
  { post_id: "1", post_type: "Reel IG", published_at: "2026-06-22T00:40:00", views: 42636, likes: 727, comments: 4, shares: 203, saves: 30, follows: 35, is_collab: false },
  { post_id: "2", post_type: "Reel IG", published_at: "2026-07-06T01:09:00", views: 21226, likes: 910, comments: 9, shares: 54, saves: 11, follows: 9, is_collab: false },
  { post_id: "3", post_type: "Gambar IG", published_at: "2026-06-19T00:33:00", views: 43307, likes: 365, comments: 12, shares: 157, saves: 48, follows: 18, is_collab: false },
  { post_id: "4", post_type: "Reel IG", published_at: "2026-06-18T23:25:00", views: 46852, likes: 381, comments: 5, shares: 107, saves: 0, follows: null, is_collab: true },
];

// --- interaksi & ER per konten ---
ok("interactionsOf jumlah 4 komponen", interactionsOf(contents[0]) === 964);
ok("erOf % 2 desimal", erOf(contents[0]) === 2.26);
ok("erOf tanpa views -> null", erOf({ likes: 5 }) === null);

// --- filter periode & kolaborasi ---
ok("contentInPeriod bulan Juni tanpa kolab", contentInPeriod(contents, "2026-06").length === 2);
ok("contentInPeriod ikutkan kolab", contentInPeriod(contents, "2026-06", { includeCollab: true }).length === 3);
ok("isReel deteksi", isReel(contents[0]) && !isReel(contents[2]));

// --- top konten ---
const top = topContents(contentInPeriod(contents, null), { onlyReels: true, limit: 5 });
ok("topContents hanya Reels, urut views", top.length === 2 && top[0].post_id === "1");
ok("topContents bawa er & interactions", top[0].er === 2.26 && top[1].interactions === 984);
ok("topContents by follows", topContents(contents.filter((c) => !c.is_collab), { by: "follows", limit: 1 })[0].post_id === "1");

// --- ER akun & ringkasan ---
ok("accountEr agregat", accountEr(contents.slice(0, 3)) === 2.36);
ok("accountEr kosong -> null", accountEr([]) === null);
const sum = contentSummary(contents.slice(0, 3));
ok("contentSummary lengkap", sum.count === 3 && sum.reels === 2 && sum.views === 107169 && sum.follows === 62 && sum.er === 2.36);

// --- contentTypeBreakdown ---
const ctb = contentTypeBreakdown([
  { post_type: "Reel IG", views: 1000, likes: 50, comments: 0, shares: 0, saves: 0, follows: 5 },
  { post_type: "Reel IG", views: 3000, likes: 100, comments: 0, shares: 0, saves: 0, follows: 3 },
  { post_type: "Gambar IG", views: 500, likes: 25, comments: 0, shares: 0, saves: 0, follows: 1 },
]);
ok("breakdown: Reel teratas (views)", ctb[0].type === "Reel" && ctb[0].count === 2 && ctb[0].views === 4000 && ctb[0].follows === 8);
ok("breakdown: ER agregat per jenis", ctb[0].er === 3.75 && ctb[1].er === 5);
ok("postTypeShort buang suffix IG", postTypeShort("Carousel IG") === "Carousel" && postTypeShort("") === "Lainnya");

// --- hashtagStats ---
const hs = hashtagStats([
  { description: "seru #eliocoffeehouse #event", views: 1000, likes: 100, comments: 0, shares: 0, saves: 0 },
  { description: "#ElioCoffeeHouse lagi", views: 3000, likes: 60, comments: 0, shares: 0, saves: 0 },
], { limit: 5 });
ok("hashtag: case-insensitive digabung", hs[0].hashtag === "#eliocoffeehouse" && hs[0].count === 2);
ok("hashtag: avgViews & avgEr", hs[0].avgViews === 2000 && hs[0].avgEr === 4);

// --- cumulativeFollowerSeries ---
const fd = [
  { metric: "new_followers", date: "2026-07-01", value: 5 },
  { metric: "new_followers", date: "2026-07-02", value: 3 },
  { metric: "new_followers", date: "2026-07-03", value: 2 },
  { metric: "views", date: "2026-07-01", value: 999 }, // metrik lain diabaikan
];
// Jangkar snapshot 2 Jul = 1000 -> akhir 1 Jul 997, akhir 2 Jul 1000, akhir 3 Jul 1002.
const cs1 = cumulativeFollowerSeries(fd, { snapshot_date: "2026-07-02", followers: 1000 });
ok("cumSeries: jangkar tepat di tengah", cs1.length === 3 && cs1[0].y === 997 && cs1[1].y === 1000 && cs1[2].y === 1002);
const cs2 = cumulativeFollowerSeries(fd, null);
ok("cumSeries: tanpa jangkar mulai 0", cs2[0].y === 5 && cs2[2].y === 10);
ok("cumSeries: kosong aman", cumulativeFollowerSeries([], null).length === 0);

// --- availableMonths ---
ok("availableMonths gabung 2 sumber, terbaru dulu", JSON.stringify(availableMonths(daily, contents)) === '["2026-07","2026-06"]');

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
