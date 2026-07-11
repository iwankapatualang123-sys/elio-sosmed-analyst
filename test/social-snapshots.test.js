// File: test/social-snapshots.test.js
// Tes helper snapshot akun sosmed manual (lib/social/snapshots.js).
// Jalankan: npm run test:snapshots

const {
  sortSnapshots, latestSnapshot, followerTrend, daysSince, isStale, groupByPlatform,
} = require("../lib/social/snapshots.js");

let pass = 0;
let fail = 0;
function ok(name, cond) { if (cond) { pass += 1; console.log(`  ok  ${name}`); } else { fail += 1; console.log(`FAIL  ${name}`); } }

const rows = [
  { platform: "instagram", snapshot_date: "2026-07-06", followers: 1200, reach_30d: 5000 },
  { platform: "instagram", snapshot_date: "2026-06-29", followers: 1150 },
  { platform: "threads", snapshot_date: "2026-07-01", followers: 300 },
];

// --- sortSnapshots / latestSnapshot ---
ok("sort urut tanggal naik", sortSnapshots(rows)[0].snapshot_date === "2026-06-29");
ok("sort tidak mengubah array asal", rows[0].snapshot_date === "2026-07-06");
ok("latest ambil terbaru", latestSnapshot(rows).snapshot_date === "2026-07-06");
ok("latest kosong -> null", latestSnapshot([]) === null);

// --- followerTrend ---
const tr = followerTrend(rows.filter((r) => r.platform === "instagram"));
ok("trend: latest & delta benar", tr.latest.followers === 1200 && tr.delta === 50);
ok("trend: 1 snapshot -> delta null", followerTrend([rows[2]]).delta === null);
ok("trend: baris tanpa followers diabaikan", followerTrend([{ snapshot_date: "2026-07-07", reach_30d: 9 }, ...rows.filter((r) => r.platform === "instagram")]).latest.followers === 1200);
ok("trend kosong aman", followerTrend([]).latest === null);

// --- daysSince / isStale ---
ok("daysSince hitung selisih hari", daysSince("2026-07-06", "2026-07-11") === 5);
ok("daysSince lintas bulan", daysSince("2026-06-29", "2026-07-11") === 12);
ok("daysSince input rusak -> null", daysSince("kemarin", "2026-07-11") === null);
ok("stale: 5 hari belum basi", isStale(rows.filter((r) => r.platform === "instagram"), "2026-07-11") === false);
ok("stale: 12 hari -> basi", isStale([rows[1]], "2026-07-11") === true);
ok("stale: tanpa data -> false (bukan peringatan)", isStale([], "2026-07-11") === false);
ok("stale: ambang custom", isStale(rows.filter((r) => r.platform === "instagram"), "2026-07-11", 3) === true);

// --- groupByPlatform ---
const g = groupByPlatform(rows);
ok("group pisah per platform", g.get("instagram").length === 2 && g.get("threads").length === 1);
ok("group tiap platform urut naik", g.get("instagram")[0].snapshot_date === "2026-06-29");

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
