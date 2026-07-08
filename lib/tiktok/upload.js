// File: lib/tiktok/upload.js
// Tujuan: orkestrator upload data TikTok — membongkar arsip (zip, termasuk zip
// BERSARANG seperti Followers.zip yang isinya 4 xlsx), mengumpulkan file .xlsx,
// lalu memanggil parser + sync. Juga mendeteksi username dari nama file untuk
// peringatan "salah cabang". Sesuai blueprint bagian 19.
//
// Prinsip desain (blueprint bagian 16 & 19):
// - MURNI orkestrasi: menerima daftar file {filename, buffer} + client Supabase
//   (di-inject, RLS berlaku) + info cabang. Tidak menyentuh HTTP/UI/DB langsung.
// - Tahan file aneh: file tak dikenal / arsip rusak -> warning + skip, bukan crash
//   (blueprint bagian 19: "File tidak dikenal -> skip + beri tahu user").
// - Dedup ditangani di layer sync (upsert). Di sini cuma ekstrak + salurkan.
//
// Struktur nyata export (tervalidasi 2026-07-09): tiap unduhan TikTok Studio berupa
// .zip; Followers.zip berisi FollowerActivity/Gender/History/TopTerritories.xlsx.
// Modul CommonJS (server-side saja; fflate untuk unzip pure-JS).

const { unzipSync } = require('fflate');
const parser = require('./parser.js');
const sync = require('./sync.js');

// Batas kedalaman arsip bersarang (jaga-jaga zip-bomb / rekursi tak wajar).
const MAX_ARCHIVE_DEPTH = 4;

// ---------------------------------------------------------------------------
// Helper nama file
// ---------------------------------------------------------------------------

// Fungsi: basename — ambil nama file dari path (buang folder).
function basename(name) {
  return String(name == null ? '' : name).split(/[\\/]/).pop() || '';
}

function isZip(name) { return /\.zip$/i.test(name); }
function isXlsx(name) { return /\.xlsx$/i.test(name); }
function isRar(name) { return /\.rar$/i.test(name); }

// Fungsi: toUint8
// Normalisasi berbagai bentuk buffer jadi Uint8Array untuk fflate.
// Input: Buffer | Uint8Array | ArrayBuffer. Output: Uint8Array.
function toUint8(buffer) {
  if (buffer instanceof Uint8Array) return buffer; // Buffer Node juga lolos di sini
  if (buffer instanceof ArrayBuffer) return new Uint8Array(buffer);
  return new Uint8Array(buffer);
}

// Fungsi: detectUsernameFromFilename
// Tebak username TikTok dari nama file arsip (blueprint bagian 19), untuk
// mengingatkan kalau user salah pilih cabang.
// Pola: "Content_elioagency.zip", "Content_elioagency (1).zip",
//       "Overview_2026-06-09_1783356516_elioagency.zip".
// Input: nama file. Output: username huruf-kecil, atau null kalau tak terdeteksi.
function detectUsernameFromFilename(name) {
  const stripped = basename(name)
    .replace(/\.(zip|xlsx|xls|rar|csv)$/i, '')
    .replace(/\s*\(\d+\)\s*$/, ''); // buang penanda duplikat " (1)"
  const parts = stripped.split('_').filter(Boolean);
  if (parts.length < 2) return null;
  // Username biasanya token terakhir yang BUKAN angka murni & BUKAN tanggal.
  for (let i = parts.length - 1; i >= 1; i -= 1) {
    const t = parts[i];
    if (/^\d+$/.test(t)) continue;
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) continue;
    return t.toLowerCase();
  }
  return null;
}

// ---------------------------------------------------------------------------
// Ekstraksi arsip
// ---------------------------------------------------------------------------

// Fungsi: extractXlsxFiles
// Bongkar daftar file upload jadi kumpulan file .xlsx. Menangani: .xlsx langsung,
// .zip (rekursif untuk zip bersarang). .rar & format lain -> warning + skip.
// Input: array { filename, buffer }, options. Output: { files: [{filename, buffer,
// source}], warnings: [] }.
function extractXlsxFiles(files) {
  const collected = [];
  const warnings = [];

  const walk = (name, buffer, depth, source) => {
    const b = basename(name);
    if (isXlsx(b)) {
      collected.push({ filename: b, buffer, source: source || b });
      return;
    }
    if (isZip(b)) {
      if (depth >= MAX_ARCHIVE_DEPTH) {
        warnings.push(`Arsip "${b}" terlalu dalam (nested > ${MAX_ARCHIVE_DEPTH}) — dilewati.`);
        return;
      }
      let entries;
      try {
        entries = unzipSync(toUint8(buffer));
      } catch (err) {
        warnings.push(`Gagal membuka zip "${b}": ${err && err.message ? err.message : String(err)}`);
        return;
      }
      let foundData = false;
      for (const entryPath of Object.keys(entries)) {
        if (entryPath.endsWith('/')) continue; // folder
        const eb = basename(entryPath);
        if (eb.startsWith('.') || eb.startsWith('__MACOSX')) continue;
        if (isXlsx(eb) || isZip(eb)) {
          walk(entryPath, entries[entryPath], depth + 1, source || b);
          foundData = true;
        }
      }
      if (!foundData) warnings.push(`Zip "${b}" tidak berisi file .xlsx/.zip yang dikenali.`);
      return;
    }
    if (isRar(b)) {
      warnings.push(`Format .rar belum didukung untuk upload otomatis — ekstrak dulu jadi .zip/.xlsx lalu upload ulang. File "${b}" dilewati.`);
      return;
    }
    warnings.push(`File "${b}" bukan .zip/.xlsx — dilewati.`);
  };

  for (const f of files) walk(f.filename, f.buffer, 0, null);
  return { files: collected, warnings };
}

// ---------------------------------------------------------------------------
// Orkestrasi upload penuh
// ---------------------------------------------------------------------------

// Fungsi: processUpload
// Alur lengkap: deteksi salah-cabang -> ekstrak arsip -> parse tiap xlsx -> sync
// (upsert) -> ringkasan gabungan untuk notifikasi (blueprint bagian 19 & 22).
// Input:
//   supabase - client terikat sesi user (RLS berlaku)
//   account  - { id, tiktok_username } cabang yang DIPILIH user
//   files    - array { filename, buffer } hasil upload
//   options  - diteruskan ke parser (referenceDate, reportDate, snapshotDate)
// Output (async): {
//   ok, perFile:[summary], totals:{files,added,updated,skipped,failed},
//   warnings:[], detectedUsernames:[], usernameMismatch: bool }
async function processUpload(supabase, account, files, options = {}) {
  const accountId = account && account.id;
  const warnings = [];

  // Deteksi username dari nama file arsip terluar (peringatan salah cabang).
  const detected = new Set();
  for (const f of files) {
    const u = detectUsernameFromFilename(f.filename);
    if (u) detected.add(u);
  }
  const detectedUsernames = [...detected];
  let usernameMismatch = false;
  if (account && account.tiktok_username) {
    const expected = String(account.tiktok_username).toLowerCase().replace(/^@/, '');
    const mismatched = detectedUsernames.filter((u) => u !== expected);
    if (mismatched.length) {
      usernameMismatch = true;
      warnings.push(`File terdeteksi milik @${mismatched.join(', @')}, tapi Anda memilih cabang @${expected}. Pastikan tidak salah cabang sebelum menyimpan.`);
    }
  }

  // Bongkar arsip jadi xlsx.
  const { files: xlsxFiles, warnings: extractWarnings } = extractXlsxFiles(files);
  warnings.push(...extractWarnings);

  if (xlsxFiles.length === 0) {
    warnings.push('Tidak ada file .xlsx yang bisa diproses dari upload ini.');
    return { ok: false, perFile: [], totals: { files: 0, added: 0, updated: 0, skipped: 0, failed: 0 }, warnings, detectedUsernames, usernameMismatch };
  }

  // Parse semua lalu sync (upsert) berurutan.
  const parseResults = [];
  for (const xf of xlsxFiles) {
    parseResults.push(await parser.parseWorkbook(xf.buffer, xf.filename, options));
  }
  const { perFile, totals } = await sync.syncParseResults(supabase, accountId, parseResults, options);

  return { ok: totals.failed === 0, perFile, totals, warnings, detectedUsernames, usernameMismatch };
}

module.exports = {
  MAX_ARCHIVE_DEPTH,
  detectUsernameFromFilename,
  extractXlsxFiles,
  processUpload,
};
