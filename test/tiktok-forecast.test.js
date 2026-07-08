// Tes forecast (lib/tiktok/forecast.js). Jalankan: npm run test:forecast.
const { linearRegression, forecastNext } = require("../lib/tiktok/forecast.js");

let pass = 0;
let fail = 0;
function ok(name, cond) { if (cond) { pass += 1; console.log(`  ok  ${name}`); } else { fail += 1; console.log(`FAIL  ${name}`); } }

const up = linearRegression([10, 20, 30, 40]);
ok("slope naik ~10", Math.abs(up.slope - 10) < 0.001);
ok("intercept ~10", Math.abs(up.intercept - 10) < 0.001);

const f = forecastNext([10, 20, 30, 40], 3);
ok("trend naik", f.trend === "naik");
ok("proyeksi 3 titik", f.projected.length === 3);
ok("next value ~70", f.nextValue === 70);

const down = forecastNext([100, 90, 80, 70], 2);
ok("trend turun", down.trend === "turun");

const flat = forecastNext([50, 50, 50], 5);
ok("trend stabil", flat.trend === "stabil");

ok("deret kosong aman", forecastNext([], 3).nextValue === 0);

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail === 0 ? 0 : 1);
