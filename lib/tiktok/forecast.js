// File: lib/tiktok/forecast.js
// Forecasting sederhana (blueprint 21A): proyeksi tren pakai regresi linear
// least-squares. Bukan AI berat — cukup untuk perkiraan arah follower/views.
// Murni, mudah dites.

// Fungsi: linearRegression — hitung slope & intercept dari deret nilai (x=0,1,2,…).
export function linearRegression(values) {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: n ? values[0] : 0 };
  let sx = 0; let sy = 0; let sxy = 0; let sxx = 0;
  values.forEach((y, x) => { sx += x; sy += y; sxy += x * y; sxx += x * x; });
  const denom = n * sxx - sx * sx;
  const slope = denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

// Fungsi: forecastNext
// Proyeksikan `days` nilai berikutnya dari deret. Input: array angka, days.
// Output: { slope, trend: 'naik'|'turun'|'stabil', projected: [angka], nextValue }.
export function forecastNext(values, days = 7) {
  const clean = (values || []).map((v) => Number(v) || 0);
  const { slope, intercept } = linearRegression(clean);
  const n = clean.length;
  const projected = [];
  for (let i = 1; i <= days; i += 1) projected.push(Math.round(intercept + slope * (n - 1 + i)));
  return {
    slope: Math.round(slope * 100) / 100,
    trend: slope > 0.01 ? "naik" : slope < -0.01 ? "turun" : "stabil",
    projected,
    nextValue: projected[projected.length - 1] ?? (clean[n - 1] || 0),
  };
}
