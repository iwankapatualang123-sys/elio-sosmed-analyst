// File: lib/instagram/metrics.js
// Agregasi data Instagram (Tahap B) di atas hasil upload Tahap A:
//   - metrik harian akun  -> total per bulan / sepanjang data
//   - data per konten     -> Top Reels, ER per konten, ER akun, follower dari konten
// Murni fungsi data (tanpa I/O), pola sama dgn lib/tiktok/metrics.

// 'YYYY-MM' dari tanggal/timestamp; null bila tidak valid.
function monthOf(d) {
  const s = String(d ?? "").slice(0, 7);
  return /^\d{4}-\d{2}$/.test(s) ? s : null;
}

// Fungsi: sumDaily — total metrik harian utk 1 bulan ('YYYY-MM') atau semua (null).
// Input rows: [{ metric, date, value }]. Output: { views, reach, profile_visits,
// new_followers, interactions, days } — metrik tanpa data = null (bukan 0 palsu),
// days = jumlah tanggal unik yang terekam (untuk label transparansi).
export function sumDaily(rows = [], month = null) {
  const out = { views: null, reach: null, profile_visits: null, new_followers: null, interactions: null };
  const dates = new Set();
  for (const r of rows) {
    if (month && monthOf(r.date) !== month) continue;
    if (!(r.metric in out)) continue;
    out[r.metric] = (out[r.metric] || 0) + (r.value || 0);
    dates.add(String(r.date).slice(0, 10));
  }
  return { ...out, days: dates.size };
}

// Fungsi: dailySeries — deret harian 1 metrik (urut tanggal) utk grafik.
export function dailySeries(rows = [], metric, month = null) {
  return rows
    .filter((r) => r.metric === metric && (!month || monthOf(r.date) === month))
    .map((r) => ({ date: String(r.date).slice(0, 10), value: r.value || 0 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Interaksi sebuah konten = suka + komentar + dibagikan + disimpan (null aman).
export function interactionsOf(c = {}) {
  return (c.likes || 0) + (c.comments || 0) + (c.shares || 0) + (c.saves || 0);
}

// Fungsi: erOf — ER 1 konten (%) = interaksi / tayangan. Tanpa tayangan -> null.
export function erOf(c = {}) {
  if (!c.views) return null;
  return Math.round((interactionsOf(c) / c.views) * 10000) / 100;
}

// Fungsi: contentInPeriod — filter konten by bulan terbit + opsi tanpa kolaborasi.
// month null = semua. includeCollab default false (ranking milik akun sendiri).
export function contentInPeriod(contents = [], month = null, { includeCollab = false } = {}) {
  return contents.filter((c) => {
    if (!includeCollab && c.is_collab) return false;
    if (month && monthOf(c.published_at) !== month) return false;
    return true;
  });
}

// Fungsi: isReel — deteksi Reels dari post_type ('Reel IG').
export function isReel(c = {}) {
  return /reel/i.test(String(c.post_type ?? ""));
}

// Fungsi: topContents — ranking konten berdasar views (default) dgn opsi khusus
// Reels dan batas jumlah. Output tiap item ditambah er & interactions.
export function topContents(contents = [], { onlyReels = false, limit = 5, by = "views" } = {}) {
  return contents
    .filter((c) => (onlyReels ? isReel(c) : true))
    .map((c) => ({ ...c, interactions: interactionsOf(c), er: erOf(c) }))
    .sort((a, b) => (b[by] || 0) - (a[by] || 0))
    .slice(0, limit);
}

// Fungsi: accountEr — ER akun (%) = total interaksi ÷ total tayangan seluruh
// konten (yang punya angka tayangan). Kosong -> null.
export function accountEr(contents = []) {
  let inter = 0;
  let views = 0;
  for (const c of contents) {
    if (!c.views) continue;
    inter += interactionsOf(c);
    views += c.views;
  }
  if (!views) return null;
  return Math.round((inter / views) * 10000) / 100;
}

// Fungsi: contentSummary — ringkasan 1 periode utk kartu KPI konten.
// Output: { count, reels, views, interactions, follows, er }.
export function contentSummary(contents = []) {
  const out = { count: contents.length, reels: 0, views: 0, interactions: 0, follows: 0, er: null };
  for (const c of contents) {
    if (isReel(c)) out.reels += 1;
    out.views += c.views || 0;
    out.interactions += interactionsOf(c);
    out.follows += c.follows || 0;
  }
  out.er = accountEr(contents);
  return out;
}

// Fungsi: availableMonths — daftar 'YYYY-MM' yang punya data (harian ATAU konten),
// terbaru dulu — untuk pemilih bulan / menentukan bulan default tampilan.
export function availableMonths(dailyRows = [], contents = []) {
  const set = new Set();
  for (const r of dailyRows) { const m = monthOf(r.date); if (m) set.add(m); }
  for (const c of contents) { const m = monthOf(c.published_at); if (m) set.add(m); }
  return [...set].sort().reverse();
}
