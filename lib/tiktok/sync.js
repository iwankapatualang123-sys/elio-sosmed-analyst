// File: lib/tiktok/sync.js
// Tujuan: menyimpan hasil parse dari lib/tiktok/parser.js ke tabel Supabase TikTok
// memakai UPSERT (deduplikasi timpa, sesuai blueprint bagian 19), lalu mengembalikan
// ringkasan { ditambah, diperbarui, dilewati } untuk notifikasi ke user.
//
// Prinsip desain (blueprint bagian 16 & 19):
// - Dipisah per platform (khusus TikTok), tidak mencampur logika Instagram/dll.
// - DEPENDENCY INJECTION: fungsi menerima instance client Supabase dari pemanggil
//   (route handler / server action) yang sudah terikat sesi user — supaya RLS
//   (can_access_account: INSERT/UPDATE hanya admin & manager) tetap berlaku, dan
//   modul ini gampang dites tanpa jaringan (cukup pakai client tiruan).
// - TIDAK menaruh service-role key di sini. Jangan pernah dipanggil dari kode client.
// - Upsert per-batch + hitung baru vs diperbarui dengan cek key existing lebih dulu.
//
// Modul CommonJS (server-side saja).

const parser = require('./parser.js');

// ---------------------------------------------------------------------------
// Konfigurasi tabel per jenis file
// conflict  = kolom unique untuk ON CONFLICT upsert (sudah ada index-nya di DB).
// keyCols   = kolom yang membentuk "identitas baris" (tanpa account_id) untuk
//             membedakan data BARU vs DIPERBARUI saat menghitung ringkasan.
// ---------------------------------------------------------------------------
const TABLE_CONFIG = {
  [parser.FILE_TYPES.CONTENT]: {
    table: 'tiktok_content',
    conflict: ['tiktok_account_id', 'video_id'],
    keyCols: ['video_id'],
  },
  [parser.FILE_TYPES.OVERVIEW]: {
    table: 'tiktok_daily_overview',
    conflict: ['tiktok_account_id', 'date'],
    keyCols: ['date'],
  },
  [parser.FILE_TYPES.FOLLOWER_HISTORY]: {
    table: 'tiktok_follower_history',
    conflict: ['tiktok_account_id', 'date'],
    keyCols: ['date'],
  },
  [parser.FILE_TYPES.FOLLOWER_GENDER]: {
    table: 'tiktok_follower_gender',
    conflict: ['tiktok_account_id', 'snapshot_date'],
    keyCols: ['snapshot_date'],
  },
  [parser.FILE_TYPES.FOLLOWER_TERRITORIES]: {
    table: 'tiktok_follower_territories',
    conflict: ['tiktok_account_id', 'snapshot_date', 'territory_code'],
    keyCols: ['snapshot_date', 'territory_code'],
  },
  [parser.FILE_TYPES.FOLLOWER_ACTIVITY]: {
    table: 'tiktok_follower_activity',
    conflict: ['tiktok_account_id', 'date', 'hour'],
    keyCols: ['date', 'hour'],
  },
  [parser.FILE_TYPES.VIEWERS]: {
    table: 'tiktok_viewers',
    conflict: ['tiktok_account_id', 'date'],
    keyCols: ['date'],
  },
};

// Ukuran batch upsert & cek-existing (jaga-jaga file besar / limit payload).
const UPSERT_BATCH = 500;
const SELECT_BATCH = 300;

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

// Fungsi: chunk
// Pecah array jadi potongan-potongan berukuran `size`. Input: array, size.
// Output: array of array.
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Fungsi: compositeKey
// Buat string kunci gabungan dari beberapa kolom sebuah baris, untuk membandingkan
// baris parse dengan baris yang sudah ada di DB. Input: row, daftar kolom.
// Output: string (mis. "2026-07-01|13").
function compositeKey(row, cols) {
  return cols.map((c) => String(row[c])).join('|');
}

// Fungsi: fetchExistingKeys
// Ambil kunci baris yang SUDAH ada di DB untuk account ini, agar bisa menghitung
// berapa yang baru vs diperbarui. Query difilter pakai kolom pertama keyCols
// (di-batch), lalu dicocokkan penuh secara komposit di memori.
// Input: supabase client, nama tabel, accountId, keyCols, rows hasil parse.
// Output (async): Set berisi compositeKey baris yang sudah ada.
async function fetchExistingKeys(supabase, table, accountId, keyCols, rows) {
  const firstCol = keyCols[0];
  const firstVals = [...new Set(rows.map((r) => r[firstCol]))];
  const existing = new Set();
  for (const batch of chunk(firstVals, SELECT_BATCH)) {
    const { data, error } = await supabase
      .from(table)
      .select(keyCols.join(','))
      .eq('tiktok_account_id', accountId)
      .in(firstCol, batch);
    if (error) throw new Error(`gagal cek data existing di ${table}: ${error.message}`);
    for (const existingRow of data || []) existing.add(compositeKey(existingRow, keyCols));
  }
  return existing;
}

// Fungsi: upsertRows
// Jalankan upsert per-batch ke sebuah tabel. Input: supabase, table, string
// onConflict, rows (sudah mengandung tiktok_account_id). Melempar Error kalau gagal.
async function upsertRows(supabase, table, onConflict, rows) {
  for (const batch of chunk(rows, UPSERT_BATCH)) {
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict, ignoreDuplicates: false });
    if (error) throw new Error(`gagal upsert ke ${table}: ${error.message}`);
  }
}

// Fungsi: emptySummary
// Bentuk objek ringkasan awal yang konsisten untuk 1 file.
function emptySummary(parseResult) {
  return {
    filename: parseResult.filename || null,
    fileType: parseResult.fileType || null,
    table: null,
    added: 0,
    updated: 0,
    // `skipped` = baris yang sudah dibuang parser (mis. tanpa video_id / tanggal invalid).
    skipped: (parseResult.stats && parseResult.stats.skipped) || 0,
    total: (parseResult.rows || []).length,
    warnings: parseResult.warnings || [],
    error: null,
  };
}

// ---------------------------------------------------------------------------
// API utama
// ---------------------------------------------------------------------------

// Fungsi: syncParseResult
// Simpan hasil parse SATU file ke tabel yang sesuai (upsert) + hitung ringkasan.
// Tidak melempar untuk kegagalan yang wajar (file tak dikenal, error RLS/DB):
// kesalahan dikembalikan di field `error` supaya alur upload banyak file tidak putus.
// Input: supabase client (terikat sesi user), accountId (uuid cabang), parseResult
//        (dari parser.parseWorkbook), options.
// Output (async): ringkasan { filename, fileType, table, added, updated, skipped, total, warnings, error }.
async function syncParseResult(supabase, accountId, parseResult, options = {}) {
  const summary = emptySummary(parseResult);

  if (!accountId) {
    summary.error = 'tiktok_account_id wajib diisi (pilih cabang dulu).';
    return summary;
  }
  const config = TABLE_CONFIG[parseResult.fileType];
  if (!config) {
    // File tidak dikenal / sudah di-skip parser — bukan error, cuma tidak disimpan.
    summary.skipped = summary.total || summary.skipped;
    return summary;
  }
  summary.table = config.table;

  const rows = parseResult.rows || [];
  if (rows.length === 0) return summary;

  try {
    // Hitung baru vs diperbarui berdasarkan key yang sudah ada di DB.
    const existing = await fetchExistingKeys(supabase, config.table, accountId, config.keyCols, rows);
    let added = 0;
    for (const row of rows) {
      if (!existing.has(compositeKey(row, config.keyCols))) added += 1;
    }
    summary.added = added;
    summary.updated = rows.length - added;

    // Tempelkan tiktok_account_id lalu upsert.
    const withAccount = rows.map((r) => ({ ...r, tiktok_account_id: accountId }));
    await upsertRows(supabase, config.table, config.conflict.join(','), withAccount);
  } catch (err) {
    summary.error = err && err.message ? err.message : String(err);
    summary.added = 0;
    summary.updated = 0;
  }
  return summary;
}

// Fungsi: syncParseResults
// Simpan BANYAK hasil parse sekaligus (mis. semua file dalam satu upload) dan
// kembalikan ringkasan per-file + total gabungan. Diproses berurutan supaya beban
// ke Supabase terkendali. Input: supabase, accountId, array parseResult, options.
// Output (async): { perFile: [...summary], totals: { files, added, updated, skipped, failed } }.
async function syncParseResults(supabase, accountId, parseResults, options = {}) {
  const perFile = [];
  for (const parseResult of parseResults) {
    // Sengaja berurutan (bukan paralel) supaya beban ke Supabase terkendali.
    perFile.push(await syncParseResult(supabase, accountId, parseResult, options));
  }
  const totals = perFile.reduce(
    (acc, s) => ({
      files: acc.files + 1,
      added: acc.added + s.added,
      updated: acc.updated + s.updated,
      skipped: acc.skipped + s.skipped,
      failed: acc.failed + (s.error ? 1 : 0),
    }),
    { files: 0, added: 0, updated: 0, skipped: 0, failed: 0 },
  );
  return { perFile, totals };
}

// Fungsi: parseAndSyncWorkbook
// Pintasan: parse satu buffer .xlsx lalu langsung sync. Berguna dipanggil dari
// route handler upload setelah arsip (zip/rar) dibongkar jadi file-file xlsx.
// Input: supabase, accountId, buffer, filename, options. Output (async): ringkasan 1 file.
async function parseAndSyncWorkbook(supabase, accountId, buffer, filename, options = {}) {
  const parseResult = await parser.parseWorkbook(buffer, filename, options);
  return syncParseResult(supabase, accountId, parseResult, options);
}

module.exports = {
  TABLE_CONFIG,
  syncParseResult,
  syncParseResults,
  parseAndSyncWorkbook,
  // helper di-export untuk unit test
  chunk,
  compositeKey,
};
