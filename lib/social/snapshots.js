// File: lib/social/snapshots.js
// Helper snapshot akun sosmed non-TikTok (Instagram/Threads) — Lapis 1 input
// manual mingguan. Murni fungsi data (tanpa I/O) supaya bisa diuji terpisah,
// mengikuti pola lib/tiktok/*. Dipakai Dashboard (tren follower + pengingat
// basi) dan halaman Upload (daftar snapshot terakhir per cabang).

// Platform yang dicatat manual. TikTok TIDAK di sini — datanya dari export report.
export const SNAPSHOT_PLATFORMS = [
  { key: "instagram", label: "Instagram", icon: "📸" },
  { key: "threads", label: "Threads", icon: "🧵" },
];
export const SNAPSHOT_PLATFORM_KEYS = SNAPSHOT_PLATFORMS.map((p) => p.key);

// Fungsi: sortSnapshots — urutkan naik berdasar snapshot_date ('YYYY-MM-DD').
export function sortSnapshots(rows = []) {
  return [...rows].sort((a, b) => String(a.snapshot_date || "").localeCompare(String(b.snapshot_date || "")));
}

// Fungsi: latestSnapshot — snapshot terbaru (atau null bila kosong).
export function latestSnapshot(rows = []) {
  const s = sortSnapshots(rows);
  return s.length ? s[s.length - 1] : null;
}

// Fungsi: followerTrend — follower terakhir + selisih vs snapshot sebelumnya.
// Hanya baris dengan followers terisi yang dihitung (baris reach-saja diabaikan).
// Output: { latest, prev, delta } — delta null bila belum ada pembanding.
export function followerTrend(rows = []) {
  const s = sortSnapshots(rows.filter((r) => r.followers != null));
  const latest = s.length ? s[s.length - 1] : null;
  const prev = s.length > 1 ? s[s.length - 2] : null;
  return { latest, prev, delta: latest && prev ? latest.followers - prev.followers : null };
}

// Fungsi: daysSince — jarak hari dua tanggal 'YYYY-MM-DD' (today - date).
// Input tidak valid -> null (jangan diam-diam 0, nanti pengingat basi tak muncul).
export function daysSince(dateStr, todayStr) {
  const d = String(dateStr || "").slice(0, 10);
  const t = String(todayStr || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  return Math.round((Date.parse(t) - Date.parse(d)) / 86400000);
}

// Fungsi: isStale — true bila snapshot terbaru sudah lewat > maxDays hari
// (default 7 = ritme input mingguan). Tanpa data sama sekali -> false (yang
// tampil ajakan mulai input, bukan peringatan basi).
export function isStale(rows = [], todayStr, maxDays = 7) {
  const latest = latestSnapshot(rows);
  if (!latest) return false;
  const d = daysSince(latest.snapshot_date, todayStr);
  return d != null && d > maxDays;
}

// Fungsi: groupByPlatform — Map platform -> rows (urut tanggal naik).
export function groupByPlatform(rows = []) {
  const out = new Map();
  for (const r of sortSnapshots(rows)) {
    const k = r.platform || "";
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(r);
  }
  return out;
}
