// File: lib/tiktok/plan-import.js
// Parsing MURNI file Excel (.xlsx) Rencana Konten -> baris siap-simpan. Tanpa
// Supabase/auth supaya bisa diuji (test/tiktok-plan-import.test.js). Dedup & insert
// tetap di app/content-plan/actions.js.
//
// Tahan format planner ASLI user: baris header tidak selalu di baris 1 (ada judul
// banner ter-merge di atasnya + kadang header ganda), ada kolom "Outlet" per baris
// (untuk routing ke cabang), tanggal bisa format panjang JS toString, dan file punya
// banyak sheet (Content Plan / Content Plan Juli / dst) — pemanggil memilih sheet.

import ExcelJS from "exceljs";

// Samakan teks header: kecil, satukan pemisah jadi spasi tunggal.
export function normHeader(v) {
  return String(v ?? "").toLowerCase().replace(/[\s._/]+/g, " ").trim();
}

// Peta alias header -> kolom tabel. Cocok bila header persis salah satu alias.
export const HEADER_ALIASES = {
  seq: ["no", "nomor", "seq", "urutan"],
  post_date: ["tanggal post", "tanggal", "post date", "date", "tgl", "tgl post", "post"],
  month_label: ["bulan", "month", "periode"],
  pic: ["pic", "penanggung jawab"],
  headline: ["headline", "hook", "headline hook", "judul"],
  topic: ["topic", "topik", "redaksi", "topic redaksi", "brief", "footage"],
  goals_content: ["goals content", "goals", "goal", "tujuan"],
  primary_pillar: ["primary pillar", "pillar utama", "primary"],
  secondary_pillar: ["secondary pillar", "pillar kedua", "secondary"],
  content_type: ["type of content", "type", "tipe", "content type", "tipe konten", "type konten"],
  reference_url: ["reference content", "reference", "referensi", "link referensi", "reference url", "referensi url"],
  posted_url: ["link tayang", "posted url", "link konten", "link konten tayang", "url tayang", "link tayang url"],
  notes: ["keterangan", "notes", "catatan", "konten pengganti", "keterangan konten pengganti"],
  acc_to_posting: ["acc to posting", "acc", "approved", "acc posting", "acc to post"],
  outlet: ["outlet", "cabang", "toko", "store", "branch", "unit"],
};

// Nama bulan ID/EN -> nomor, untuk kolom "Bulan" (mis. "Juli 2026").
const MONTHS = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6, juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, agu: 8, ags: 8, sep: 9, sept: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12,
  january: 1, february: 2, march: 3, may: 5, june: 6, july: 7, august: 8, october: 10, december: 12,
};

const pad2 = (n) => String(n).padStart(2, "0");
const isoFromUTC = (d) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;

// Ubah nilai sel tanggal apa pun (Date Excel, string ISO/DD-MM/format panjang JS) -> 'YYYY-MM-DD' | null.
export function cellToDate(val) {
  if (val == null || val === "") return null;
  if (val instanceof Date && !Number.isNaN(val.getTime())) return isoFromUTC(val);
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10); // YYYY-MM-DD
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/); // DD/MM/YYYY
  if (dmy) return `${dmy[3]}-${pad2(dmy[2])}-${pad2(dmy[1])}`;
  // Nama bulan + hari + tahun ("Apr 14 2026" / "Tue Apr 14 2026 07:00:00 GMT+0700 …").
  // Ambil KOMPONEN langsung (bukan Date.parse) supaya bebas geser zona waktu.
  const named = s.match(/([A-Za-z]{3,})\s+(\d{1,2})\s+(\d{4})/);
  if (named) {
    const mo = MONTHS[named[1].toLowerCase()];
    const day = parseInt(named[2], 10);
    const year = parseInt(named[3], 10);
    if (mo && day >= 1 && day <= 31) return `${year}-${pad2(mo)}-${pad2(day)}`;
  }
  return null;
}

// 'YYYY-MM-01' dari label bulan ("Juli 2026") atau tanggal apa pun; null bila gagal.
export function monthFromLabel(val) {
  if (val == null || val === "") return null;
  const d = cellToDate(val);
  if (d) return `${d.slice(0, 7)}-01`;
  const m = String(val).toLowerCase().match(/([a-z]+)[\s.]*(\d{4})/);
  if (m && MONTHS[m[1]]) return `${m[2]}-${pad2(MONTHS[m[1]])}-01`;
  return null;
}

// Interpretasi kolom ACC (ya/yes/true/1/✓/acc/sudah -> true).
export function cellToBool(val) {
  const s = String(val ?? "").trim().toLowerCase();
  return ["ya", "yes", "true", "1", "v", "✓", "acc", "ok", "sudah", "done"].includes(s);
}

// Ambil teks sel rapi (tangani objek rich-text/hyperlink/formula exceljs).
export function cellText(val) {
  if (val == null) return "";
  if (val instanceof Date) return "";
  if (typeof val === "object") {
    if (val.text) return String(val.text).trim();
    if (val.hyperlink) return String(val.hyperlink).trim();
    if (Array.isArray(val.richText)) return val.richText.map((t) => t.text).join("").trim();
    if (val.result != null) return String(val.result).trim();
    return "";
  }
  return String(val).trim();
}

// Cocokkan satu teks header ke nama field, atau null.
function fieldForHeader(text) {
  const h = normHeader(text);
  if (!h) return null;
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(h)) return field;
  }
  return null;
}

// Cari baris header di antara beberapa baris pertama (judul banner sering di baris 1).
// Kembalikan { headerRowIndex, colToField } dengan kecocokan alias terbanyak (≥3).
export function findHeaderRow(ws, scanRows = 10) {
  let best = { headerRowIndex: 0, colToField: {}, matches: 0 };
  const limit = Math.min(scanRows, ws.rowCount || scanRows);
  for (let r = 1; r <= limit; r += 1) {
    const row = ws.getRow(r);
    const colToField = {};
    let matches = 0;
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const field = fieldForHeader(cellText(cell.value));
      if (field && !Object.values(colToField).includes(field)) { colToField[colNumber] = field; matches += 1; }
    });
    if (matches > best.matches) best = { headerRowIndex: r, colToField, matches };
  }
  // ≥2 kolom cocok = cukup yakin ini baris header (ambil baris dgn kecocokan terbanyak).
  return best.matches >= 2 ? best : { headerRowIndex: 0, colToField: {}, matches: 0 };
}

// Pilih sheet default: yang namanya mirip "content plan"/"rencana", jika tidak ada
// pakai sheet pertama. (Hindari BANK CONTENT / Sosmed Report ikut terpilih otomatis.)
function pickDefaultSheet(wb) {
  const named = wb.worksheets.find((w) => /content ?plan|rencana|plan konten/i.test(w.name) && !/bank/i.test(w.name));
  return named || wb.worksheets[0];
}

// Baris data yang isinya justru teks header (header ganda) harus dilewati.
function isHeaderEcho(rec) {
  return fieldForHeader(cellText(rec.headline)) === "headline" || normHeader(cellText(rec.seq)) === "no";
}

// Parse buffer .xlsx -> { records, skippedEmpty, sheetUsed, sheetNames, headerRowIndex }.
// Opsi: sheetName (pilih sheet), fallbackMonth ('YYYY-MM-01' untuk baris tanpa tanggal/bulan).
export async function parsePlanWorkbook(buffer, { fallbackMonth, sheetName } = {}) {
  const fb = /^\d{4}-\d{2}-01$/.test(fallbackMonth || "") ? fallbackMonth : `${new Date().toISOString().slice(0, 7)}-01`;
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    throw new Error("File bukan Excel (.xlsx) yang valid.");
  }
  const sheetNames = wb.worksheets.map((w) => w.name);
  const ws = (sheetName && wb.worksheets.find((w) => w.name === sheetName)) || pickDefaultSheet(wb);
  if (!ws) throw new Error("Sheet kosong.");

  const { headerRowIndex, colToField } = findHeaderRow(ws);
  if (headerRowIndex === 0) {
    throw new Error("Header tidak dikenali di sheet ini. Pastikan ada kolom seperti Headline/Hook, PIC, Post. Coba pilih sheet lain atau pakai template resmi.");
  }

  const records = [];
  let skippedEmpty = 0;
  for (let r = headerRowIndex + 1; r <= ws.rowCount; r += 1) {
    const row = ws.getRow(r);
    const rec = {};
    for (const [colNumber, field] of Object.entries(colToField)) {
      rec[field] = row.getCell(Number(colNumber)).value;
    }
    if (isHeaderEcho(rec)) continue; // baris header yang terduplikasi

    const headline = cellText(rec.headline);
    let post_date = cellToDate(rec.post_date);
    if (!headline && !post_date) { skippedEmpty += 1; continue; } // baris kosong

    // Kolom "Bulan" (mis. "Juli 2026") = acuan periode. Kalau tanggal Post ternyata
    // BULANNYA sama tapi TAHUNNYA beda (typo tahun yang sering terjadi di Excel,
    // mis. "15 Jul 2025" padahal Bulan "Juli 2026") -> koreksi tahunnya ke label.
    const labelMonth = monthFromLabel(rec.month_label); // 'YYYY-MM-01' | null
    if (post_date && labelMonth && post_date.slice(5, 7) === labelMonth.slice(5, 7) && post_date.slice(0, 4) !== labelMonth.slice(0, 4)) {
      post_date = `${labelMonth.slice(0, 4)}${post_date.slice(4)}`;
    }

    const seqNum = cellText(rec.seq).replace(/[^\d]/g, "");
    const plan_month = post_date ? `${post_date.slice(0, 7)}-01` : (labelMonth || fb);
    records.push({
      plan_month,
      post_date,
      seq: seqNum === "" ? null : parseInt(seqNum, 10),
      pic: cellText(rec.pic) || null,
      headline: headline || null,
      topic: cellText(rec.topic) || null,
      goals_content: cellText(rec.goals_content) || null,
      primary_pillar: cellText(rec.primary_pillar) || null,
      secondary_pillar: cellText(rec.secondary_pillar) || null,
      content_type: cellText(rec.content_type) || null,
      reference_url: cellText(rec.reference_url) || null,
      posted_url: cellText(rec.posted_url) || null,
      notes: cellText(rec.notes) || null,
      acc_to_posting: cellToBool(rec.acc_to_posting),
      status_override: null,
      outlet: cellText(rec.outlet) || "", // kosong = tidak ada outlet; dirouting via default
    });
  }
  return { records, skippedEmpty, sheetUsed: ws.name, sheetNames, headerRowIndex };
}

// Rangkum nilai Outlet unik + jumlah baris (untuk langkah pratinjau mapping).
// "" (kosong) dipertahankan sebagai satu grup terpisah.
export function summarizeOutlets(records) {
  const counts = new Map();
  for (const rec of records) {
    const key = rec.outlet || "";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}
