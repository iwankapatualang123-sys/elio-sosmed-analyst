// File: test/tiktok-alerts.test.js
// Tes evaluateAlerts (lib/tiktok/alerts.js). Jalankan: npm run test:alerts.

const { evaluateAlerts } = require("../lib/tiktok/alerts.js");

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) { pass += 1; console.log(`  ok  ${name}`); }
  else { fail += 1; console.log(`FAIL  ${name}`); }
}
const has = (alerts, title) => alerts.some((a) => a.title === title);

const ref = new Date("2026-07-09T00:00:00Z");

// Skenario @elioagency: follower naik, ER wajar, 0 konten bulan ini, data segar, top video viral.
const a1 = evaluateAlerts({
  summary: { engagementRateOverall: 4.83, avgViewsPerPost: 2802 },
  growth: { netGrowth: 7, startFollowers: 257, endFollowers: 264 },
  topVideo: { video_title: "Happy Monday", total_views: 17060 },
  latestDataDate: "2026-07-07", contentThisMonth: 0, referenceDate: ref,
});
ok("stagnan (0 konten bulan ini)", has(a1, "Belum ada konten bulan ini"));
ok("viral (17060 >> 2802)", has(a1, "Video melonjak"));
ok("tidak ada 'follower turun' (net +7)", !has(a1, "Follower turun"));
ok("tidak ada reminder (data 2 hari)", !has(a1, "Data belum diperbarui"));
ok("tidak ada ER rendah (4.83%)", !has(a1, "Engagement rendah"));

// Follower turun + ER rendah + data basi
const a2 = evaluateAlerts({
  summary: { engagementRateOverall: 1.2, avgViewsPerPost: 100 },
  growth: { netGrowth: -10, startFollowers: 300, endFollowers: 290 },
  topVideo: { video_title: "x", total_views: 120 },
  latestDataDate: "2026-06-01", contentThisMonth: 3, referenceDate: ref,
});
ok("follower turun (danger)", has(a2, "Follower turun") && a2.find((x) => x.title === "Follower turun").level === "danger");
ok("ER rendah", has(a2, "Engagement rendah"));
ok("reminder upload (data basi)", has(a2, "Data belum diperbarui"));
ok("tidak stagnan (ada konten)", !has(a2, "Belum ada konten bulan ini"));
ok("tidak viral (120 < 300)", !has(a2, "Video melonjak"));

// Penurunan follower harian drastis (net masih positif)
const a3 = evaluateAlerts({
  summary: { engagementRateOverall: 5 },
  growth: { netGrowth: 2, startFollowers: 1000, endFollowers: 1002, worstDay: { date: "2026-07-05", diff: -80 } },
  latestDataDate: "2026-07-08", contentThisMonth: 5, referenceDate: ref,
});
ok("penurunan harian drastis (80/1000=8%)", has(a3, "Penurunan follower harian"));

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail === 0 ? 0 : 1);
