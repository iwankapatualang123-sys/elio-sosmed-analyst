// File: test/tiktok-insights.test.js
// Tes generator insight formula (lib/tiktok/insights.js). Jalankan: npm run test:insights.

const { generateInsights, buildInsightPrompt } = require("../lib/tiktok/insights.js");

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) { pass += 1; console.log(`  ok  ${name}`); }
  else { fail += 1; console.log(`FAIL  ${name}`); }
}

const ins = generateInsights({
  summary: { totalVideos: 15, totalViews: 42025, avgViewsPerPost: 2802, engagementRateOverall: 4.83 },
  growth: { netGrowth: 7, startFollowers: 257, endFollowers: 264, days: 28 },
  viewers: { newPct: 83, returningPct: 17, daysCounted: 6 },
  bestHours: { topHours: [{ hour: 20, avgActive: 67 }] },
  hashtags: [{ hashtag: "#fyp", count: 12, avgViews: 2679 }],
});

ok("4 aspek", ins.length === 4);
ok("aspek konten ada", ins[0].aspek === "Konten & Performa Views");
ok("engagement wajar (4.83% -> stabil)", ins[1].status === "stabil");
ok("follower naik (net +7)", ins[2].status === "naik");
ok("retensi 17% -> stabil", ins[3].status === "stabil");
ok("kesimpulan mengandung angka views", ins[0].kesimpulan.includes("42.025"));
ok("saran hashtag #fyp", ins[0].saran.includes("#fyp"));
ok("jam ramai 20:00 muncul", ins[3].kesimpulan.includes("20:00"));

// Ambang ekstrem
const low = generateInsights({ summary: { engagementRateOverall: 1.2 }, growth: { netGrowth: -5 }, viewers: { returningPct: 10, newPct: 90, daysCounted: 3 } });
ok("ER 1.2% -> turun", low[1].status === "turun");
ok("follower -5 -> turun", low[2].status === "turun");
ok("retensi 10% -> turun", low[3].status === "turun");

const high = generateInsights({ summary: { engagementRateOverall: 8 }, growth: { netGrowth: 50 }, viewers: { returningPct: 45, newPct: 55, daysCounted: 5 } });
ok("ER 8% -> naik", high[1].status === "naik");
ok("retensi 45% -> naik", high[3].status === "naik");

ok("prompt berisi nama cabang", buildInsightPrompt("Elio", ins).includes("Elio"));

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail === 0 ? 0 : 1);
