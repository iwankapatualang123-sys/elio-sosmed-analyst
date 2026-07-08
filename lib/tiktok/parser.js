// File: lib/tiktok/parser.js
// Tujuan: Parsing file export TikTok Studio (Content.xlsx, Overview.xlsx,
// FollowerHistory/Gender/TopTerritories/Activity.xlsx, Viewers.xlsx) menjadi
// array objek yang SIAP di-upsert ke tabel Supabase (dikonsumsi lib/tiktok/sync.js).
//
// Prinsip desain (lihat Catatan_Update_Blueprint.md bagian 2, 16, 19):
// - MURNI transformasi data: TIDAK menyentuh Supabase / jaringan, biar gampang dites.
// - TIDAK PERNAH crash karena data kotor. Anomali TikTok (nilai "undefined",
//   sel kosong, angka negatif seperti comments -1) di-FLAG, bukan bikin throw.
// - Deteksi header FLEKSIBEL (Inggris/Indonesia) karena nama kolom export bisa
//   beda antar bahasa akun.
// - Video ID di-extract dari URL (tidak ada kolom ID terpisah di export).
// - Tanggal format Indonesia tanpa tahun ("8 Juli") -> infer tahun + map nama bulan.
//
// ⚠️ CATATAN VALIDASI: pemetaan nama kolom di ALIASES masih berbasis spesifikasi
// blueprint + tebakan wajar, BELUM diverifikasi ke file export TikTok Studio asli.
// Setiap hasil parse menyertakan array `warnings`; kalau ada peringatan
// "kolom X tidak ditemukan", sesuaikan ALIASES di file ini dengan header sebenarnya.
//
// Modul CommonJS (dipakai server-side di Next.js route handler / server action;
// exceljs adalah dependency Node-only, tidak boleh diimpor di komponen client).

const ExcelJS = require('exceljs');

// ---------------------------------------------------------------------------
// Konstanta
// ---------------------------------------------------------------------------

// Jenis file yang dikenali. Nilainya dipakai sebagai kunci dispatch ke parser
// dan mencerminkan tabel Supabase tujuan (tiktok_<jenis>).
const FILE_TYPES = {
  CONTENT: 'content',
  OVERVIEW: 'overview',
  FOLLOWER_HISTORY: 'follower_history',
  FOLLOWER_GENDER: 'follower_gender',
  FOLLOWER_TERRITORIES: 'follower_territories',
  FOLLOWER_ACTIVITY: 'follower_activity',
  VIEWERS: 'viewers',
};

// Peta nama bulan (Indonesia + Inggris, termasuk singkatan) -> nomor bulan 1-12.
const MONTHS = {
  januari: 1, jan: 1, january: 1,
  februari: 2, feb: 2, february: 2, pebruari: 2, peb: 2,
  maret: 3, mar: 3, march: 3, mrt: 3,
  april: 4, apr: 4,
  mei: 5, may: 5,
  juni: 6, jun: 6, june: 6,
  juli: 7, jul: 7, july: 7,
  agustus: 8, agu: 8, agt: 8, ags: 8, aug: 8, august: 8,
  september: 9, sep: 9, sept: 9,
  oktober: 10, okt: 10, oct: 10, october: 10,
  november: 11, nov: 11, nop: 11,
  desember: 12, des: 12, dec: 12, december: 12,
};

// Alias header per "kunci kolom" (sudah dalam bentuk ternormalisasi: huruf kecil,
// tanpa spasi/tanda baca/diakritik). Dipakai buildHeaderIndex untuk mencocokkan
// header sebenarnya dengan kolom yang kita butuhkan.
const ALIASES = {
  // umum
  date: ['date', 'tanggal', 'tgl', 'day', 'hari', 'periode'],
  // content (per video)
  title: ['videotitle', 'title', 'judul', 'judulvideo', 'caption', 'deskripsi', 'description', 'posttitle', 'namavideo', 'konten'],
  link: ['videolink', 'link', 'url', 'tautan', 'videourl', 'postlink', 'linkvideo'],
  postdate: ['postdate', 'posttime', 'datepublished', 'published', 'tanggalposting', 'tanggalunggah', 'tanggalpost', 'waktuposting', 'diposting', 'tanggaldibuat', 'date', 'tanggal'],
  // waktu data diambil / snapshot (kolom "Time" di Content.xlsx) -> report_generated_date
  report_time: ['time', 'waktu', 'reporttime', 'datagenerated', 'snapshottime', 'lastupdated', 'terakhirdiperbarui', 'diambil'],
  views: ['totalviews', 'views', 'videoviews', 'tayangan', 'jumlahtayangan', 'ditonton', 'playcount', 'plays'],
  likes: ['totallikes', 'likes', 'like', 'suka', 'jumlahsuka', 'disukai'],
  comments: ['totalcomments', 'comments', 'comment', 'komentar', 'jumlahkomentar'],
  shares: ['totalshares', 'shares', 'share', 'bagikan', 'dibagikan', 'jumlahbagikan', 'dibagi'],
  // overview (harian)
  video_views: ['videoviews', 'views', 'tayanganvideo', 'tayangan', 'jumlahtayangan'],
  profile_views: ['profileviews', 'profileview', 'tayanganprofil', 'kunjunganprofil', 'profildilihat', 'kunjungan'],
  // follower history (harian)
  followers: ['followers', 'follower', 'pengikut', 'totalfollowers', 'jumlahpengikut', 'totalpengikut'],
  diff: ['netfollowers', 'net', 'change', 'diff', 'selisih', 'perubahan', 'growth', 'pertumbuhan', 'followergrowth', 'netgrowth', 'netchange', 'perubahanharian'],
  // gender (snapshot)
  male: ['male', 'pria', 'laki', 'lakilaki', 'man', 'men', 'cowok'],
  female: ['female', 'wanita', 'perempuan', 'woman', 'women', 'cewek'],
  other: ['other', 'others', 'lainnya', 'lain', 'unknown', 'tidakdiketahui', 'nonbiner'],
  gender_label: ['gender', 'jeniskelamin', 'kelamin', 'jenis'],
  // territories (snapshot)
  territory: ['country', 'countryregion', 'territory', 'territories', 'topterritories', 'region', 'negara', 'wilayah', 'lokasi', 'location', 'daerah', 'territori'],
  // nilai persentase / proporsi generik (dipakai gender & territories orientasi baris)
  pct: ['percentage', 'percent', 'persen', 'persentase', 'pct', 'proporsi', 'distribution', 'distribusi', 'value', 'nilai', 'jumlah', 'proportion'],
  // activity (per jam)
  hour: ['hour', 'hourofday', 'jam', 'jamke', 'waktu', 'time'],
  active_followers: ['activefollowers', 'activefollower', 'followeraktif', 'pengikutaktif', 'aktif', 'followersactive', 'jumlahaktif'],
  // viewers (harian)
  total_viewers: ['totalviewers', 'totalviewer', 'totalpenonton', 'penonton', 'viewers', 'jumlahpenonton'],
  new_viewers: ['newviewers', 'newviewer', 'penontonbaru', 'baru', 'new'],
  returning_viewers: ['returningviewers', 'returningviewer', 'penontonkembali', 'kembali', 'returning', 'returned', 'pengunjungkembali'],
};

// Nilai teks yang dianggap "tidak ada / tidak lengkap" (anomali TikTok).
const EMPTY_TOKENS = ['', 'undefined', 'null', 'n/a', 'na', 'nan', '-', '—', 'none'];

// ---------------------------------------------------------------------------
// Helper string & angka
// ---------------------------------------------------------------------------

// Fungsi: normalizeHeader
// Normalisasi teks header/label supaya cocok dibandingkan dengan ALIASES.
// Input: nilai apa pun. Output: string huruf-kecil tanpa spasi/tanda baca/diakritik.
function normalizeHeader(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // buang diakritik
    .replace(/[^a-z0-9]/g, '');
}

// Fungsi: round2
// Bulatkan angka ke 2 desimal (untuk persentase).
function round2(n) {
  return Math.round(n * 100) / 100;
}

// Fungsi: pad2
// Format angka jadi 2 digit dengan nol di depan (untuk tanggal ISO).
function pad2(n) {
  return String(n).padStart(2, '0');
}

// Fungsi: formatISO
// Rangkai tahun/bulan/hari jadi string tanggal ISO "YYYY-MM-DD".
function formatISO(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

// Fungsi: toDate
// Konversi input (Date/string/number) jadi objek Date. Output: Date (bisa Invalid).
function toDate(x) {
  if (x instanceof Date) return x;
  return new Date(x);
}

// Fungsi: parseIntCell
// Parse nilai sel jadi bilangan bulat, sekaligus deteksi anomali.
// Input: nilai sel (number/string/null). Menangani pemisah ribuan (titik/koma)
// dan token kosong ("undefined", "-", dst).
// Output: { value: int|null, incomplete: bool, negative: bool }
//   - incomplete=true kalau sel kosong/undefined (data belum lengkap).
//   - negative=true kalau hasilnya < 0 (anomali TikTok, mis. comments -1). Nilai
//     TETAP dipertahankan apa adanya supaya UI bisa menandai, bukan menyembunyikan.
function parseIntCell(value) {
  if (value === null || value === undefined) return { value: null, incomplete: true, negative: false };
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return { value: null, incomplete: true, negative: false };
    const v = Math.trunc(value);
    return { value: v, incomplete: false, negative: v < 0 };
  }
  const s = String(value).trim();
  if (EMPTY_TOKENS.includes(s.toLowerCase())) return { value: null, incomplete: true, negative: false };
  const neg = /^-/.test(s);
  const digits = s.replace(/[^\d]/g, ''); // buang pemisah ribuan & simbol
  if (digits === '') return { value: null, incomplete: true, negative: false };
  let n = parseInt(digits, 10);
  if (Number.isNaN(n)) return { value: null, incomplete: true, negative: false };
  if (neg) n = -n;
  return { value: n, incomplete: false, negative: n < 0 };
}

// Fungsi: parsePctCell
// Parse nilai sel jadi persentase (0-100). Menangani format "55%", "55,5",
// atau fraksi Excel (0.55 -> 55). Input: nilai sel. Output: { value: number|null,
// incomplete: bool }.
// Catatan: fraksi (0 < n <= 1 tanpa tanda %) diasumsikan perlu dikali 100 — ini
// heuristik; persentase asli 1% yang tersimpan sebagai teks "1" akan tetap 1,
// tapi angka Excel 0.01 akan jadi 1. Sesuai perilaku sel persen Excel.
function parsePctCell(value) {
  if (value === null || value === undefined) return { value: null, incomplete: true };
  if (typeof value === 'number') {
    let v = value;
    if (v > 0 && v <= 1) v = v * 100; // sel persen Excel tersimpan sebagai fraksi
    return { value: round2(v), incomplete: false };
  }
  let s = String(value).trim().toLowerCase();
  if (EMPTY_TOKENS.includes(s)) return { value: null, incomplete: true };
  const hasPercent = s.includes('%');
  s = s.replace('%', '').replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(s);
  if (Number.isNaN(n)) return { value: null, incomplete: true };
  const v = (!hasPercent && n > 0 && n <= 1) ? n * 100 : n;
  return { value: round2(v), incomplete: false };
}

// ---------------------------------------------------------------------------
// Helper tanggal
// ---------------------------------------------------------------------------

// Fungsi: inferYear
// Tebak tahun untuk tanggal tanpa tahun (mis. "8 Juli"). Data export selalu
// historis, jadi kalau tanggal (tahun-sekarang) jatuh di MASA DEPAN relatif ke
// tanggal acuan, berarti maksudnya tahun lalu.
// Input: month (1-12), day, referenceDate (Date). Output: tahun (number).
function inferYear(month, day, referenceDate) {
  const ref = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();
  let year = ref.getFullYear();
  const candidate = new Date(year, month - 1, day);
  const refDay = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  if (candidate.getTime() > refDay.getTime()) year -= 1;
  return year;
}

// Fungsi: parseIndoDate
// Parse tanggal dari berbagai format ke ISO "YYYY-MM-DD".
// Format didukung: Date object (dari sel Excel), serial Excel, ISO (yyyy-mm-dd),
// dd/mm/yyyy, "8 Juli 2025", "8 Juli"/"8 Jul" (infer tahun), "Jul 8, 2025".
// Input: nilai sel + options.referenceDate (untuk infer tahun).
// Output: { iso: string|null, incomplete: bool, unparsed?: bool }.
function parseIndoDate(value, options = {}) {
  const ref = options.referenceDate ? toDate(options.referenceDate) : new Date();

  if (value === null || value === undefined) return { iso: null, incomplete: true };

  if (value instanceof Date) {
    // Sel tanggal Excel dikembalikan exceljs sebagai Date pada tengah malam UTC;
    // pakai komponen UTC supaya tidak bergeser 1 hari karena zona waktu.
    if (Number.isNaN(value.getTime())) return { iso: null, incomplete: true, unparsed: true };
    return { iso: formatISO(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate()), incomplete: false };
  }

  if (typeof value === 'number') {
    // Serial Excel (sistem 1900): 25569 = 1970-01-01. Jarang terjadi karena
    // exceljs biasanya sudah mengubah sel tanggal jadi Date.
    if (value > 20000 && value < 60000) {
      const d = new Date(Math.round((value - 25569) * 86400 * 1000));
      return { iso: formatISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()), incomplete: false };
    }
    return { iso: null, incomplete: true, unparsed: true };
  }

  const s = String(value).trim();
  if (EMPTY_TOKENS.includes(s.toLowerCase())) return { iso: null, incomplete: true };

  // ISO: yyyy-mm-dd / yyyy/mm/dd
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return { iso: formatISO(+m[1], +m[2], +m[3]), incomplete: false };

  // dd/mm/yyyy / dd-mm-yyyy (urutan hari-bulan, umum di Indonesia)
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return { iso: formatISO(+m[3], +m[2], +m[1]), incomplete: false };

  // "8 Juli 2025" / "8 Jul" / "8 Juli" (urutan hari-bulan-[tahun])
  m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\.?(?:\s+(\d{4}))?$/);
  if (m) {
    const mon = MONTHS[m[2].toLowerCase()];
    if (mon) {
      const day = +m[1];
      const year = m[3] ? +m[3] : inferYear(mon, day, ref);
      return { iso: formatISO(year, mon, day), incomplete: false };
    }
  }

  // "Juli 8, 2025" / "Jul 8" (urutan bulan-hari, gaya Inggris)
  m = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/);
  if (m) {
    const mon = MONTHS[m[1].toLowerCase()];
    if (mon) {
      const day = +m[2];
      const year = m[3] ? +m[3] : inferYear(mon, day, ref);
      return { iso: formatISO(year, mon, day), incomplete: false };
    }
  }

  return { iso: null, incomplete: true, unparsed: true };
}

// ---------------------------------------------------------------------------
// Helper video ID
// ---------------------------------------------------------------------------

// Fungsi: extractVideoId
// Ambil ID video dari URL TikTok. Dipakai sebagai primary key deduplikasi karena
// export tidak punya kolom ID terpisah (blueprint bagian 2).
// Contoh: ".../video/7647134669963529479?..." -> "7647134669963529479"
// Input: string URL. Output: string video ID, atau null kalau format tak dikenali.
function extractVideoId(url) {
  if (url == null) return null;
  const s = String(url).trim();
  if (s === '') return null;
  // Pola utama: /video/<digit> (juga menangkap /photo/<digit> untuk carousel).
  let m = s.match(/\/(?:video|photo|v)\/(\d{6,25})/i);
  if (m) return m[1];
  // Fallback: query param seperti ?item_id= / ?aweme_id=
  m = s.match(/(?:item_id|aweme_id|video_id)=(\d{6,25})/i);
  if (m) return m[1];
  // Fallback terakhir: kalau seluruh string cuma angka panjang (ID mentah).
  if (/^\d{6,25}$/.test(s)) return s;
  return null;
}

// ---------------------------------------------------------------------------
// Helper sel & header exceljs
// ---------------------------------------------------------------------------

// Fungsi: cellValue
// Ambil nilai "bersih" dari sel exceljs. Menangani rich text, sel hyperlink,
// dan sel formula (ambil hasilnya). Input: cell exceljs. Output: primitive/Date/null.
function cellValue(cell) {
  if (!cell) return null;
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if (v.result !== undefined) return v.result;      // sel formula
    if (v.text !== undefined) return v.text;            // sel hyperlink (teks tampil)
    if (v.hyperlink !== undefined) return v.hyperlink;  // hyperlink tanpa teks
    return null;
  }
  return v;
}

// Fungsi: cellLink
// Ambil URL dari sel — utamakan hyperlink asli (kalau kolom link berupa hyperlink),
// jatuh ke teks biasa kalau bukan. Input: cell exceljs. Output: string URL/'' .
function cellLink(cell) {
  if (!cell) return '';
  const v = cell.value;
  if (v && typeof v === 'object' && v.hyperlink) return v.hyperlink;
  const raw = cellValue(cell);
  return raw == null ? '' : String(raw);
}

// Fungsi: buildHeaderIndex
// Cari baris header di worksheet dan petakan tiap "kunci kolom" ke nomor kolom.
// TikTok export kadang punya baris judul/preamble di atas header asli, jadi kita
// scan beberapa baris pertama dan pilih yang paling banyak cocok dengan alias.
// Input: worksheet, aliasMap { kunciKolom: [alias...] }.
// Output: { headerRowNumber: number, resolved: { kunciKolom: colNumber|null } }.
function buildHeaderIndex(ws, aliasMap) {
  const keys = Object.keys(aliasMap);
  const maxScan = Math.min(ws.rowCount || 1, 12);

  let bestRow = 1;
  let bestScore = -1;
  let bestCells = [];

  for (let r = 1; r <= maxScan; r += 1) {
    const row = ws.getRow(r);
    // Kumpulkan (colNumber, normalizedText) untuk semua sel berisi di baris ini.
    const cells = [];
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const norm = normalizeHeader(cellValue(cell));
      if (norm) cells.push({ col: colNumber, norm });
    });
    // Skor = jumlah kunci kolom yang punya minimal 1 sel cocok di baris ini.
    let score = 0;
    for (const key of keys) {
      if (matchColumn(cells, aliasMap[key]) !== null) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestRow = r;
      bestCells = cells;
    }
  }

  // Petakan tiap kunci ke kolom pada baris header terpilih; hindari 1 kolom
  // dipakai 2 kunci (kolom yang sudah terpakai dikecualikan).
  const resolved = {};
  const used = new Set();
  for (const key of keys) {
    const col = matchColumn(bestCells, aliasMap[key], used);
    resolved[key] = col;
    if (col !== null) used.add(col);
  }
  return { headerRowNumber: bestRow, resolved };
}

// Fungsi: matchColumn
// Cari nomor kolom yang header-nya cocok dengan salah satu alias. Prioritas:
// cocok persis > cocok sebagian (substring). Input: daftar {col, norm}, daftar
// alias ternormalisasi, set kolom yang sudah terpakai (opsional). Output: colNumber|null.
function matchColumn(cells, aliases, used = new Set()) {
  // 1) cocok persis
  for (const a of aliases) {
    for (const c of cells) {
      if (!used.has(c.col) && c.norm === a) return c.col;
    }
  }
  // 2) cocok sebagian (header mengandung alias, atau sebaliknya)
  for (const a of aliases) {
    for (const c of cells) {
      if (used.has(c.col)) continue;
      if (c.norm.includes(a) || a.includes(c.norm)) return c.col;
    }
  }
  return null;
}

// Fungsi: eachDataRow
// Iterasi baris data (setelah baris header). Melewati baris yang benar-benar
// kosong. Input: ws, headerRowNumber, callback(row, rowNumber).
function eachDataRow(ws, headerRowNumber, callback) {
  const last = ws.rowCount || headerRowNumber;
  for (let r = headerRowNumber + 1; r <= last; r += 1) {
    const row = ws.getRow(r);
    let hasValue = false;
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (cellValue(cell) !== null && cellValue(cell) !== '') hasValue = true;
    });
    if (hasValue) callback(row, r);
  }
}

// Fungsi: makeStats
// Bentuk ringkasan hasil parse yang konsisten. Input: parsed/flagged/skipped.
function makeStats(parsed, flagged, skipped) {
  return { parsed, flagged, skipped };
}

// Fungsi: resolveReferenceISO
// Tentukan tanggal acuan untuk data snapshot (gender/territories/activity yang
// tidak punya kolom tanggal). Urutan: options.snapshotDate > options.reportDate >
// hari ini. Input: options. Output: string ISO.
function resolveReferenceISO(options = {}) {
  const src = options.snapshotDate || options.reportDate;
  const d = src ? toDate(src) : new Date();
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  return formatISO(safe.getFullYear(), safe.getMonth() + 1, safe.getDate());
}

// ---------------------------------------------------------------------------
// Parser per jenis file
// Semua parser mengembalikan { rows, warnings, stats }. `rows` TIDAK menyertakan
// tiktok_account_id / id / created_at — itu ditambahkan oleh lib/tiktok/sync.js.
// ---------------------------------------------------------------------------

// Fungsi: parseContent
// Parse Content.xlsx (per video) -> baris tabel tiktok_content.
// Video tanpa video_id (URL tidak dikenali) dilewati + di-warn (tidak bisa dedup).
function parseContent(ws, options = {}) {
  const warnings = [];
  // Fallback tanggal report dari opsi, dipakai kalau file tidak punya kolom "Time".
  const reportOptISO = options.reportDate ? resolveReferenceISO({ snapshotDate: options.reportDate }) : null;
  const { headerRowNumber, resolved } = buildHeaderIndex(ws, {
    // urutan: postdate diselesaikan sebelum report_time supaya "Post time" tidak
    // keburu diklaim oleh alias 'time'.
    title: ALIASES.title, link: ALIASES.link, postdate: ALIASES.postdate, report_time: ALIASES.report_time,
    views: ALIASES.views, likes: ALIASES.likes, comments: ALIASES.comments, shares: ALIASES.shares,
  });

  if (resolved.link === null) warnings.push('Content: kolom link/URL video tidak ditemukan — video_id tidak bisa di-extract.');
  if (resolved.views === null) warnings.push('Content: kolom views tidak ditemukan.');

  const rows = [];
  let flagged = 0;
  let skipped = 0;

  eachDataRow(ws, headerRowNumber, (row, rowNumber) => {
    const url = resolved.link ? cellLink(row.getCell(resolved.link)) : '';
    const videoId = extractVideoId(url);
    if (!videoId) {
      skipped += 1;
      if (skipped <= 5) warnings.push(`Content: baris ${rowNumber} dilewati — video_id tidak bisa di-extract dari URL "${url}".`);
      return;
    }

    const views = parseIntCell(resolved.views ? cellValue(row.getCell(resolved.views)) : null);
    const likes = parseIntCell(resolved.likes ? cellValue(row.getCell(resolved.likes)) : null);
    const comments = parseIntCell(resolved.comments ? cellValue(row.getCell(resolved.comments)) : null);
    const shares = parseIntCell(resolved.shares ? cellValue(row.getCell(resolved.shares)) : null);
    const title = resolved.title ? cellValue(row.getCell(resolved.title)) : null;

    // Tanggal data diambil (kolom "Time"). Selain jadi report_generated_date, ini
    // dipakai sebagai ACUAN infer tahun post_date supaya tetap benar walau file
    // di-upload jauh setelah tanggal pengambilan data.
    let reportISO = reportOptISO;
    if (resolved.report_time !== null) {
      const rt = parseIndoDate(cellValue(row.getCell(resolved.report_time)), options);
      if (rt.iso) reportISO = rt.iso;
    }
    const postOptions = reportISO ? { ...options, referenceDate: reportISO } : options;
    const post = parseIndoDate(resolved.postdate !== null ? cellValue(row.getCell(resolved.postdate)) : null, postOptions);

    const rowFlags = [];
    for (const [name, res] of [['views', views], ['likes', likes], ['comments', comments], ['shares', shares]]) {
      if (res.negative) rowFlags.push(`${name} negatif (${res.value})`);
    }
    if (post.unparsed) rowFlags.push('post_date tidak bisa diparse');
    if (rowFlags.length) {
      flagged += 1;
      warnings.push(`Content: baris ${rowNumber} (video ${videoId}) anomali — ${rowFlags.join(', ')}.`);
    }

    rows.push({
      video_id: videoId,
      video_title: title == null ? null : String(title),
      video_link: url || null,
      post_date: post.iso,
      total_views: views.value == null ? 0 : views.value,
      total_likes: likes.value == null ? 0 : likes.value,
      total_comments: comments.value == null ? 0 : comments.value,
      total_shares: shares.value == null ? 0 : shares.value,
      report_generated_date: reportISO,
    });
  });

  return { rows, warnings, stats: makeStats(rows.length, flagged, skipped) };
}

// Fungsi: parseOverview
// Parse Overview.xlsx (harian) -> baris tabel tiktok_daily_overview.
// Baris tanpa tanggal valid dilewati (date adalah bagian dari key upsert).
function parseOverview(ws, options = {}) {
  const warnings = [];
  const { headerRowNumber, resolved } = buildHeaderIndex(ws, {
    date: ALIASES.date, video_views: ALIASES.video_views, profile_views: ALIASES.profile_views,
    likes: ALIASES.likes, comments: ALIASES.comments, shares: ALIASES.shares,
  });
  if (resolved.date === null) warnings.push('Overview: kolom tanggal tidak ditemukan.');

  const rows = [];
  let flagged = 0;
  let skipped = 0;

  eachDataRow(ws, headerRowNumber, (row, rowNumber) => {
    const date = parseIndoDate(resolved.date ? cellValue(row.getCell(resolved.date)) : null, options);
    if (!date.iso) {
      skipped += 1;
      if (skipped <= 5) warnings.push(`Overview: baris ${rowNumber} dilewati — tanggal tidak valid.`);
      return;
    }
    const vv = parseIntCell(resolved.video_views ? cellValue(row.getCell(resolved.video_views)) : null);
    const pv = parseIntCell(resolved.profile_views ? cellValue(row.getCell(resolved.profile_views)) : null);
    const lk = parseIntCell(resolved.likes ? cellValue(row.getCell(resolved.likes)) : null);
    const cm = parseIntCell(resolved.comments ? cellValue(row.getCell(resolved.comments)) : null);
    const sh = parseIntCell(resolved.shares ? cellValue(row.getCell(resolved.shares)) : null);

    if ([vv, pv, lk, cm, sh].some((x) => x.negative)) {
      flagged += 1;
      warnings.push(`Overview: baris ${rowNumber} (${date.iso}) ada nilai negatif.`);
    }

    rows.push({
      date: date.iso,
      video_views: vv.value == null ? 0 : vv.value,
      profile_views: pv.value == null ? 0 : pv.value,
      likes: lk.value == null ? 0 : lk.value,
      comments: cm.value == null ? 0 : cm.value,
      shares: sh.value == null ? 0 : sh.value,
    });
  });

  return { rows, warnings, stats: makeStats(rows.length, flagged, skipped) };
}

// Fungsi: parseFollowerHistory
// Parse FollowerHistory.xlsx (harian) -> baris tabel tiktok_follower_history.
function parseFollowerHistory(ws, options = {}) {
  const warnings = [];
  const { headerRowNumber, resolved } = buildHeaderIndex(ws, {
    date: ALIASES.date, followers: ALIASES.followers, diff: ALIASES.diff,
  });
  if (resolved.followers === null) warnings.push('FollowerHistory: kolom jumlah follower tidak ditemukan.');

  const rows = [];
  let flagged = 0;
  let skipped = 0;

  eachDataRow(ws, headerRowNumber, (row, rowNumber) => {
    const date = parseIndoDate(resolved.date ? cellValue(row.getCell(resolved.date)) : null, options);
    if (!date.iso) {
      skipped += 1;
      if (skipped <= 5) warnings.push(`FollowerHistory: baris ${rowNumber} dilewati — tanggal tidak valid.`);
      return;
    }
    const followers = parseIntCell(resolved.followers ? cellValue(row.getCell(resolved.followers)) : null);
    const diff = parseIntCell(resolved.diff ? cellValue(row.getCell(resolved.diff)) : null);
    // diff boleh negatif secara wajar (follower turun) — itu BUKAN anomali, jadi
    // tidak di-flag. Yang di-flag cuma jumlah follower absolut yang negatif.
    if (followers.negative) {
      flagged += 1;
      warnings.push(`FollowerHistory: baris ${rowNumber} (${date.iso}) jumlah follower negatif.`);
    }
    rows.push({
      date: date.iso,
      followers: followers.value == null ? 0 : followers.value,
      diff_from_previous_day: diff.value == null ? 0 : diff.value,
    });
  });

  return { rows, warnings, stats: makeStats(rows.length, flagged, skipped) };
}

// Fungsi: parseFollowerGender
// Parse FollowerGender.xlsx (snapshot) -> 1 baris tabel tiktok_follower_gender.
// Menangani 2 orientasi: (a) kolom Male/Female/Other terpisah, atau (b) baris
// label gender + kolom persentase. snapshot_date diambil dari options (default hari ini).
function parseFollowerGender(ws, options = {}) {
  const warnings = [];
  const snapshotISO = resolveReferenceISO(options);
  if (!options.snapshotDate && !options.reportDate) {
    warnings.push(`FollowerGender: snapshot_date default ke hari ini (${snapshotISO}) — tidak ada tanggal snapshot di input.`);
  }

  const { headerRowNumber, resolved } = buildHeaderIndex(ws, {
    male: ALIASES.male, female: ALIASES.female, other: ALIASES.other,
    gender_label: ALIASES.gender_label, pct: ALIASES.pct,
  });

  let male = null;
  let female = null;
  let other = null;

  if (resolved.male !== null || resolved.female !== null) {
    // Orientasi kolom: baca baris data pertama.
    let dataRowNumber = null;
    eachDataRow(ws, headerRowNumber, (_row, rowNumber) => {
      if (dataRowNumber === null) dataRowNumber = rowNumber;
    });
    if (dataRowNumber !== null) {
      const row = ws.getRow(dataRowNumber);
      if (resolved.male !== null) male = parsePctCell(cellValue(row.getCell(resolved.male))).value;
      if (resolved.female !== null) female = parsePctCell(cellValue(row.getCell(resolved.female))).value;
      if (resolved.other !== null) other = parsePctCell(cellValue(row.getCell(resolved.other))).value;
    }
  } else if (resolved.gender_label !== null && resolved.pct !== null) {
    // Orientasi baris: tiap baris = 1 gender.
    eachDataRow(ws, headerRowNumber, (row) => {
      const label = normalizeHeader(cellValue(row.getCell(resolved.gender_label)));
      const pct = parsePctCell(cellValue(row.getCell(resolved.pct))).value;
      // Urutan penting: cek female DULU — string "female" mengandung "male"
      // sebagai substring, jadi kalau male dicek lebih dulu, baris Female salah kena.
      if (ALIASES.female.some((a) => label.includes(a))) female = pct;
      else if (ALIASES.male.some((a) => label.includes(a))) male = pct;
      else if (ALIASES.other.some((a) => label.includes(a))) other = pct;
    });
  } else {
    warnings.push('FollowerGender: struktur tidak dikenali (tidak ada kolom Male/Female maupun pasangan label+persentase).');
    return { rows: [], warnings, stats: makeStats(0, 0, 0) };
  }

  if (male === null && female === null) {
    warnings.push('FollowerGender: tidak ada data gender terbaca, dilewati.');
    return { rows: [], warnings, stats: makeStats(0, 0, 1) };
  }

  return {
    rows: [{ snapshot_date: snapshotISO, male_pct: male, female_pct: female, other_pct: other }],
    warnings,
    stats: makeStats(1, 0, 0),
  };
}

// Fungsi: parseFollowerTerritories
// Parse FollowerTopTerritories.xlsx (snapshot) -> baris tabel
// tiktok_follower_territories (1 baris per wilayah). Catatan: territory_code diisi
// apa adanya dari export (bisa nama negara, bukan kode ISO) — normalisasi ke kode
// resmi bisa dilakukan belakangan kalau perlu.
function parseFollowerTerritories(ws, options = {}) {
  const warnings = [];
  const snapshotISO = resolveReferenceISO(options);
  if (!options.snapshotDate && !options.reportDate) {
    warnings.push(`FollowerTopTerritories: snapshot_date default ke hari ini (${snapshotISO}).`);
  }

  const { headerRowNumber, resolved } = buildHeaderIndex(ws, {
    territory: ALIASES.territory, pct: ALIASES.pct,
  });
  if (resolved.territory === null) warnings.push('FollowerTopTerritories: kolom wilayah/negara tidak ditemukan.');

  const rows = [];
  let skipped = 0;

  eachDataRow(ws, headerRowNumber, (row, rowNumber) => {
    const terrRaw = resolved.territory !== null ? cellValue(row.getCell(resolved.territory)) : null;
    const terr = terrRaw == null ? '' : String(terrRaw).trim();
    if (!terr || EMPTY_TOKENS.includes(terr.toLowerCase())) {
      skipped += 1;
      if (skipped <= 5) warnings.push(`FollowerTopTerritories: baris ${rowNumber} dilewati — wilayah kosong.`);
      return;
    }
    const pct = parsePctCell(resolved.pct !== null ? cellValue(row.getCell(resolved.pct)) : null);
    rows.push({ snapshot_date: snapshotISO, territory_code: terr, distribution_pct: pct.value });
  });

  return { rows, warnings, stats: makeStats(rows.length, 0, skipped) };
}

// Fungsi: parseFollowerActivity
// Parse FollowerActivity.xlsx (per jam) -> baris tabel tiktok_follower_activity.
// Menangani jam berupa angka ("13"), "13:00", atau "1 PM". Kalau tidak ada kolom
// tanggal, pakai tanggal acuan (snapshot). Jam di luar 0-23 dilewati.
function parseFollowerActivity(ws, options = {}) {
  const warnings = [];
  const snapshotISO = resolveReferenceISO(options);

  const { headerRowNumber, resolved } = buildHeaderIndex(ws, {
    date: ALIASES.date, hour: ALIASES.hour, active_followers: ALIASES.active_followers,
  });
  if (resolved.hour === null) warnings.push('FollowerActivity: kolom jam tidak ditemukan.');
  if (resolved.date === null && !options.snapshotDate && !options.reportDate) {
    warnings.push(`FollowerActivity: kolom tanggal tidak ada, date default ke ${snapshotISO}.`);
  }

  const rows = [];
  let skipped = 0;

  eachDataRow(ws, headerRowNumber, (row, rowNumber) => {
    const hour = parseHour(resolved.hour !== null ? cellValue(row.getCell(resolved.hour)) : null);
    if (hour === null) {
      skipped += 1;
      if (skipped <= 5) warnings.push(`FollowerActivity: baris ${rowNumber} dilewati — jam tidak valid.`);
      return;
    }
    let dateISO = snapshotISO;
    if (resolved.date !== null) {
      const d = parseIndoDate(cellValue(row.getCell(resolved.date)), options);
      if (d.iso) dateISO = d.iso;
    }
    const active = parseIntCell(resolved.active_followers !== null ? cellValue(row.getCell(resolved.active_followers)) : null);
    rows.push({ date: dateISO, hour, active_followers: active.value == null ? 0 : active.value });
  });

  return { rows, warnings, stats: makeStats(rows.length, 0, skipped) };
}

// Fungsi: parseHour
// Parse nilai jam jadi integer 0-23. Menangani angka, "HH:MM", dan "h AM/PM".
// Input: nilai sel. Output: int 0-23, atau null kalau tidak valid.
function parseHour(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.getUTCHours();
  if (typeof value === 'number') {
    // Bisa integer jam (0-23) atau fraksi hari Excel (0.5 = 12:00).
    if (value >= 0 && value < 1) return Math.floor(value * 24);
    const h = Math.trunc(value);
    return h >= 0 && h <= 23 ? h : null;
  }
  const s = String(value).trim().toLowerCase();
  if (EMPTY_TOKENS.includes(s)) return null;
  const pm = /pm/.test(s);
  const am = /am/.test(s);
  const m = s.match(/(\d{1,2})/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  if (Number.isNaN(h)) return null;
  if (pm && h < 12) h += 12;
  if (am && h === 12) h = 0;
  return h >= 0 && h <= 23 ? h : null;
}

// Fungsi: parseViewers
// Parse Viewers.xlsx (harian) -> baris tabel tiktok_viewers. Menandai
// is_incomplete=true kalau ada nilai "undefined"/kosong pada baris (hari yang
// datanya belum lengkap), sesuai kolom is_incomplete di skema.
function parseViewers(ws, options = {}) {
  const warnings = [];
  const { headerRowNumber, resolved } = buildHeaderIndex(ws, {
    date: ALIASES.date, total_viewers: ALIASES.total_viewers,
    new_viewers: ALIASES.new_viewers, returning_viewers: ALIASES.returning_viewers,
  });
  if (resolved.date === null) warnings.push('Viewers: kolom tanggal tidak ditemukan.');

  const rows = [];
  let flagged = 0;
  let skipped = 0;

  eachDataRow(ws, headerRowNumber, (row, rowNumber) => {
    const date = parseIndoDate(resolved.date ? cellValue(row.getCell(resolved.date)) : null, options);
    if (!date.iso) {
      skipped += 1;
      if (skipped <= 5) warnings.push(`Viewers: baris ${rowNumber} dilewati — tanggal tidak valid.`);
      return;
    }
    const total = parseIntCell(resolved.total_viewers ? cellValue(row.getCell(resolved.total_viewers)) : null);
    const fresh = parseIntCell(resolved.new_viewers ? cellValue(row.getCell(resolved.new_viewers)) : null);
    const ret = parseIntCell(resolved.returning_viewers ? cellValue(row.getCell(resolved.returning_viewers)) : null);

    const incomplete = total.incomplete || fresh.incomplete || ret.incomplete;
    if (incomplete) {
      flagged += 1;
      warnings.push(`Viewers: baris ${rowNumber} (${date.iso}) ditandai is_incomplete — ada nilai kosong/undefined.`);
    }

    rows.push({
      date: date.iso,
      total_viewers: total.value,
      new_viewers: fresh.value,
      returning_viewers: ret.value,
      is_incomplete: incomplete,
    });
  });

  return { rows, warnings, stats: makeStats(rows.length, flagged, skipped) };
}

// Peta jenis file -> fungsi parser (dipakai dispatcher parseWorkbook).
const PARSERS = {
  [FILE_TYPES.CONTENT]: parseContent,
  [FILE_TYPES.OVERVIEW]: parseOverview,
  [FILE_TYPES.FOLLOWER_HISTORY]: parseFollowerHistory,
  [FILE_TYPES.FOLLOWER_GENDER]: parseFollowerGender,
  [FILE_TYPES.FOLLOWER_TERRITORIES]: parseFollowerTerritories,
  [FILE_TYPES.FOLLOWER_ACTIVITY]: parseFollowerActivity,
  [FILE_TYPES.VIEWERS]: parseViewers,
};

// ---------------------------------------------------------------------------
// Deteksi jenis file & dispatcher
// ---------------------------------------------------------------------------

// Fungsi: detectFileType
// Tentukan jenis data dari NAMA file (blueprint bagian 19). File yang tidak
// dikenali mengembalikan null (nanti di-skip, bukan error).
// Input: nama/path file (mis. "Content_elioagency.xlsx"). Output: nilai FILE_TYPES atau null.
// Urutan pengecekan penting: pola spesifik follower_* & viewers diperiksa sebelum
// pola generik supaya "FollowerGender" tidak keburu kena aturan lain.
function detectFileType(filename) {
  if (!filename) return null;
  // Ambil basename tanpa ekstensi, lalu normalisasi.
  const base = String(filename).split(/[\\/]/).pop() || '';
  const n = normalizeHeader(base.replace(/\.(xlsx|xls|csv)$/i, ''));

  if (/follower/.test(n) && /(gender|kelamin)/.test(n)) return FILE_TYPES.FOLLOWER_GENDER;
  if (/(gender|jeniskelamin)/.test(n) && !/content/.test(n)) return FILE_TYPES.FOLLOWER_GENDER;
  if (/(territor|topterritor|wilayah|negara|country)/.test(n)) return FILE_TYPES.FOLLOWER_TERRITORIES;
  if (/(followeractivity|activity|aktivitas|jamaktif)/.test(n)) return FILE_TYPES.FOLLOWER_ACTIVITY;
  if (/(followerhistory|history|riwayat)/.test(n) || (/follower/.test(n) && !/(gender|territor|activity|aktivitas)/.test(n))) return FILE_TYPES.FOLLOWER_HISTORY;
  if (/(viewer|penonton)/.test(n)) return FILE_TYPES.VIEWERS;
  if (/(overview|ringkasan|ikhtisar)/.test(n)) return FILE_TYPES.OVERVIEW;
  if (/(content|konten)/.test(n)) return FILE_TYPES.CONTENT;
  return null;
}

// Fungsi: parseWorkbook
// Dispatcher tingkat atas: terima buffer .xlsx + nama file, deteksi jenisnya,
// dan jalankan parser yang sesuai. TIDAK PERNAH throw — kegagalan (file rusak,
// tidak dikenali) dikembalikan sebagai warning + skipped:true.
// Input: buffer (Buffer/ArrayBuffer/Uint8Array), filename, options
//   options.referenceDate  - acuan infer tahun tanggal tanpa tahun (default: now)
//   options.reportDate     - tanggal report di-generate (isi report_generated_date & snapshot)
//   options.snapshotDate   - override tanggal snapshot untuk gender/territories/activity
// Output (async): { fileType, filename, rows, warnings, stats, skipped }
async function parseWorkbook(buffer, filename, options = {}) {
  const fileType = detectFileType(filename);
  if (!fileType) {
    return {
      fileType: null, filename, rows: [],
      warnings: [`File "${filename}" tidak dikenali sebagai export TikTok Studio — dilewati.`],
      stats: makeStats(0, 0, 0), skipped: true,
    };
  }
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];
    if (!ws || (ws.rowCount || 0) === 0) {
      return {
        fileType, filename, rows: [],
        warnings: [`File "${filename}" kosong / tidak ada worksheet berisi data.`],
        stats: makeStats(0, 0, 0), skipped: true,
      };
    }
    const result = PARSERS[fileType](ws, options);
    return { fileType, filename, skipped: false, ...result };
  } catch (err) {
    return {
      fileType, filename, rows: [],
      warnings: [`File "${filename}" gagal dibaca sebagai .xlsx: ${err && err.message ? err.message : String(err)}`],
      stats: makeStats(0, 0, 0), skipped: true,
    };
  }
}

module.exports = {
  FILE_TYPES,
  // dispatcher utama
  parseWorkbook,
  detectFileType,
  // helper murni (di-export untuk unit test & pemakaian ulang)
  extractVideoId,
  parseIndoDate,
  inferYear,
  parseIntCell,
  parsePctCell,
  parseHour,
  normalizeHeader,
  // parser per jenis (di-export supaya bisa dites terpisah dengan worksheet buatan)
  parseContent,
  parseOverview,
  parseFollowerHistory,
  parseFollowerGender,
  parseFollowerTerritories,
  parseFollowerActivity,
  parseViewers,
};
