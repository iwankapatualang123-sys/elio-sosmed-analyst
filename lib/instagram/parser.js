// File: lib/instagram/parser.js
// Parser file export Instagram dari Meta Business Suite. Dua format yang dikenali
// (dipelajari dari file asli outlet, 2026-07):
//
// 1) METRIK HARIAN akun (Tayangan/Jangkauan/Kunjungan Profil/Pengikut) — file
//    UTF-16LE ber-BOM, 3 baris pembuka:
//      sep=,
//      "Tayangan"                <- nama metrik
//      "Tanggal","Primary"
//      "2026-06-13T00:00:00","192"
//
// 2) PER KONTEN — CSV UTF-8 biasa, 1 baris per post/reel/story. Susunan kolom
//    BERUBAH-UBAH antar akun/export (kolom dipilih saat export), jadi WAJIB
//    dibaca berdasarkan NAMA header, bukan posisi. Deskripsi bisa multi-baris
//    (newline di dalam kutip). Tanggal terbit format Amerika MM/DD/YYYY HH:mm.
//    File bisa memuat konten kolaborasi dari akun lain -> ditandai is_collab
//    (akun "milik sendiri" = ID Akun yang paling sering muncul di file).
//
// Modul ESM murni (tanpa I/O) supaya teruji terpisah — pola sama dgn lib/tiktok.

// ————— util decode & csv —————

// Fungsi: decodeBuffer — Buffer/Uint8Array -> string. Deteksi BOM UTF-16LE
// (FF FE, dipakai file harian Business Suite); selain itu UTF-8 (strip BOM).
export function decodeBuffer(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(b.subarray(2));
  }
  if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(b.subarray(3));
  }
  return new TextDecoder("utf-8").decode(b);
}

// Fungsi: parseCsv — CSV -> array of array (state machine: kutip ganda,
// koma/newline di dalam kutip, escape ""). Cukup untuk file Meta.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuote = false;
  const s = String(text ?? "");
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (inQuote) {
      if (c === '"') {
        if (s[i + 1] === '"') { cell += '"'; i += 1; } else inQuote = false;
      } else cell += c;
    } else if (c === '"') {
      inQuote = true;
    } else if (c === ",") {
      row.push(cell); cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i += 1;
      row.push(cell); cell = "";
      rows.push(row); row = [];
    } else {
      cell += c;
    }
  }
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
  // Buang baris yang seluruh selnya kosong (trailing newline dsb).
  return rows.filter((r) => r.some((x) => String(x).trim() !== ""));
}

// int longgar: "1.234"/"1,234"/" 97 " -> 1234/97; kosong/non-angka -> null.
function intOrNull(v) {
  const s = String(v ?? "").replace(/[^\d-]/g, "");
  if (s === "" || s === "-") return null;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

// ————— format 1: metrik harian —————

// Nama metrik (baris ke-2 file) -> kunci kanonik di DB. Dicocokkan longgar
// (lowercase, contains) karena label Meta bisa berubah redaksinya.
const DAILY_METRICS = [
  { key: "views", match: /tayangan/i },
  { key: "reach", match: /jangkauan/i },
  { key: "profile_visits", match: /kunjungan/i },
  { key: "new_followers", match: /pengikut/i },
  { key: "interactions", match: /interaksi/i },
];
export const DAILY_METRIC_KEYS = DAILY_METRICS.map((m) => m.key);

// Fungsi: parseDailyMetricCsv — teks file harian -> { metric, metricLabel, rows }.
// rows: [{ date:'YYYY-MM-DD', value:int }]. Lempar Error dgn pesan jelas bila
// bentuknya bukan file harian (biar UI bisa menampilkan alasan per file).
export function parseDailyMetricCsv(text) {
  const rows = parseCsv(String(text ?? "").replace(/^sep=.*$/m, ""));
  if (rows.length < 2) throw new Error("File terlalu pendek — bukan file metrik harian.");
  const metricLabel = String(rows[0][0] ?? "").trim();
  const metric = DAILY_METRICS.find((m) => m.match.test(metricLabel))?.key || null;
  if (!metric) throw new Error(`Metrik "${metricLabel}" belum dikenali.`);

  const headerIdx = rows.findIndex((r) => /tanggal/i.test(String(r[0] ?? "")));
  if (headerIdx < 0) throw new Error('Header "Tanggal" tidak ditemukan — bukan file metrik harian.');

  const out = [];
  for (const r of rows.slice(headerIdx + 1)) {
    const date = String(r[0] ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const value = intOrNull(r[1]);
    if (value == null) continue;
    out.push({ date, value });
  }
  if (out.length === 0) throw new Error("Tidak ada baris tanggal+angka yang terbaca.");
  return { metric, metricLabel, rows: out };
}

// ————— format 2: per konten —————

// Peta NAMA header (longgar) -> kunci kolom kita. Kolom yang tidak ada di file
// (beda pilihan metrik saat export) otomatis null — jangan sampai error.
const CONTENT_HEADERS = [
  { key: "post_id", match: /^id postingan$/i },
  { key: "ig_account_id", match: /^id akun$/i },
  { key: "username", match: /^nama pengguna akun$/i },
  { key: "account_name", match: /^nama akun$/i },
  { key: "description", match: /^deskripsi$/i },
  { key: "duration_s", match: /^durasi/i },
  { key: "published_at", match: /^waktu penerbitan$/i },
  { key: "permalink", match: /^permalink$/i },
  { key: "post_type", match: /^jenis postingan$/i },
  { key: "date_scope", match: /^tanggal$/i },
  { key: "views", match: /^tayangan$/i },
  { key: "reach", match: /^jangkauan$/i },
  { key: "likes", match: /^suka$/i },
  { key: "shares", match: /^frekuensi dibagikan$/i },
  { key: "comments", match: /^komentar$/i },
  { key: "saves", match: /^frekuensi disimpan$/i },
  { key: "profile_visits", match: /^kunjungan profil$/i },
  { key: "replies", match: /^balasan$/i },
  { key: "navigation", match: /^navigasi$/i },
  { key: "sticker_taps", match: /^ketukan stiker$/i },
  { key: "follows", match: /^mengikuti$/i },
];
const CONTENT_INT_KEYS = new Set(["duration_s", "views", "reach", "likes", "shares", "comments", "saves", "profile_visits", "replies", "navigation", "sticker_taps", "follows"]);

// "06/17/2026 09:11" (MM/DD/YYYY) -> ISO '2026-06-17T09:11:00'; gagal -> null.
export function parseUsDateTime(v) {
  const m = String(v ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!m) return null;
  const [, mo, d, y, h = "0", mi = "0"] = m;
  const pad = (x) => String(x).padStart(2, "0");
  return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:00`;
}

// Fungsi: parseContentCsv — teks CSV per konten -> { rows, ownIgAccountId }.
// rows: [{ post_id, username, permalink, post_type, published_at, views, ... , is_collab }].
// Akun "sendiri" = ID Akun terbanyak di file; baris akun lain ditandai is_collab.
export function parseContentCsv(text) {
  const table = parseCsv(text);
  if (table.length < 2) throw new Error("File per konten kosong / tanpa baris data.");
  const headers = table[0].map((h) => String(h).trim());
  const colFor = {};
  headers.forEach((h, idx) => {
    const hit = CONTENT_HEADERS.find((c) => c.match.test(h));
    if (hit && colFor[hit.key] === undefined) colFor[hit.key] = idx;
  });
  if (colFor.post_id === undefined || colFor.permalink === undefined) {
    throw new Error('Header "ID Postingan"/"Permalink" tidak ditemukan — bukan file per konten.');
  }

  const rows = [];
  for (const r of table.slice(1)) {
    const rec = {};
    for (const { key } of CONTENT_HEADERS) {
      const idx = colFor[key];
      const raw = idx === undefined ? null : r[idx];
      if (CONTENT_INT_KEYS.has(key)) rec[key] = intOrNull(raw);
      else rec[key] = raw == null || String(raw).trim() === "" ? null : String(raw).trim();
    }
    if (!rec.post_id) continue;
    rec.published_at = parseUsDateTime(rec.published_at);
    rows.push(rec);
  }
  if (rows.length === 0) throw new Error("Tidak ada baris konten yang terbaca.");

  // Akun sendiri = ID Akun modus (paling sering). Baris lain = kolaborasi/tag.
  const count = new Map();
  for (const r of rows) if (r.ig_account_id) count.set(r.ig_account_id, (count.get(r.ig_account_id) || 0) + 1);
  let ownIgAccountId = null;
  let max = 0;
  for (const [id, n] of count) if (n > max) { max = n; ownIgAccountId = id; }
  for (const r of rows) r.is_collab = !!(r.ig_account_id && ownIgAccountId && r.ig_account_id !== ownIgAccountId);

  return { rows, ownIgAccountId };
}

// ————— deteksi otomatis —————

// Fungsi: parseInstagramFile — Buffer file apa pun dari Business Suite ->
// { kind:'daily', ... } | { kind:'content', ... }. Dicoba berurutan; kalau
// dua-duanya gagal, lempar error gabungan yang jelas.
export function parseInstagramFile(buf) {
  const text = decodeBuffer(buf);
  let dailyErr;
  try {
    return { kind: "daily", ...parseDailyMetricCsv(text) };
  } catch (e) { dailyErr = e; }
  try {
    return { kind: "content", ...parseContentCsv(text) };
  } catch (contentErr) {
    throw new Error(`Format tidak dikenali. Bukan metrik harian (${dailyErr.message}) dan bukan per konten (${contentErr.message})`);
  }
}
