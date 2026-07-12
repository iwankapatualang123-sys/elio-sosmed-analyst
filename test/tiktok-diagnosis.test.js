// File: test/tiktok-diagnosis.test.js
// Tes Analisis Pertumbuhan (lib/tiktok/diagnosis.js). Jalankan: npm run test:diagnosis

const { diagnoseGrowthDrop } = require("../lib/tiktok/diagnosis.js");

let pass = 0;
let fail = 0;
function ok(name, cond) { if (cond) { pass += 1; console.log(`  ok  ${name}`); } else { fail += 1; console.log(`FAIL  ${name}`); } }

const base = (over = {}) => ({
  current: { netGrowth: 50, totalVideos: 20, engagementRate: 5, ...(over.current || {}) },
  previous: { netGrowth: 100, totalVideos: 20, engagementRate: 5, videoViews: [1000, 1200, 900, 1100], ...(over.previous || {}) },
});

// Pertumbuhan MEMBAIK / sama -> tidak ada diagnosis (kartu tak muncul).
ok("naik -> null", diagnoseGrowthDrop(base({ current: { netGrowth: 150 } })) === null);
ok("sama -> null", diagnoseGrowthDrop(base({ current: { netGrowth: 100 } })) === null);

// ER turun signifikan -> vonis kualitas (warning), menang atas sebab lain.
const dKual = diagnoseGrowthDrop(base({ current: { engagementRate: 3, totalVideos: 10 } }));
ok("ER turun -> kualitas + warning", dKual.verdict === "kualitas" && dKual.level === "warning");

// Jumlah konten anjlok, ER stabil -> produksi.
const dProd = diagnoseGrowthDrop(base({ current: { totalVideos: 10 } }));
ok("konten -50% -> produksi", dProd.verdict === "produksi" && dProd.level === "warning");
ok("finding produksi berstatus turun", dProd.findings.find((f) => f.key === "produksi").status === "turun");

// Bulan lalu ada viral outlier, lainnya stabil -> normalisasi (info).
const dNorm = diagnoseGrowthDrop(base({ previous: { videoViews: [42000, 1200, 900, 1100] } }));
ok("outlier -> normalisasi + info", dNorm.verdict === "normalisasi" && dNorm.level === "info");
ok("finding outlier terdeteksi", dNorm.findings.find((f) => f.key === "outlier").status === "ada");

// Semua stabil -> distribusi (info).
const dDist = diagnoseGrowthDrop(base());
ok("stabil semua -> distribusi", dDist.verdict === "distribusi" && dDist.level === "info");
ok("growth prev/cur terbawa", dDist.growth.prev === 100 && dDist.growth.cur === 50);

// ER turun sedikit (<15% relatif) tidak dianggap sinyal kualitas.
ok("ER turun tipis -> bukan kualitas", diagnoseGrowthDrop(base({ current: { engagementRate: 4.5 } })).verdict === "distribusi");

// Viral kecil (di bawah ambang views) tidak dihitung outlier.
ok("outlier mini diabaikan", diagnoseGrowthDrop(base({ previous: { videoViews: [900, 100, 120, 110] } })).findings.find((f) => f.key === "outlier").status === "tidak");

// Data minim aman.
const dMin = diagnoseGrowthDrop({ current: { netGrowth: 1 }, previous: { netGrowth: 5 } });
ok("tanpa konten/ER tetap jalan", dMin && dMin.verdict === "distribusi");

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
