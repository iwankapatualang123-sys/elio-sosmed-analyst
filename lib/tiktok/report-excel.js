// File: lib/tiktok/report-excel.js
// Pembangun workbook laporan Excel per cabang — bergaya MODERN & fungsional:
// header ber-brand, blok KPI, tabel dengan format angka, freeze header, auto-filter,
// zebra, dan warna status (ER/selisih follower). Dipakai oleh /api/report/excel.
// Dipisah dari route agar bisa diuji & dibuatkan contoh tanpa DB.

import ExcelJS from "exceljs";

const C = {
  teal: "FF006674",
  tealDark: "FF00434B",
  tealSoft: "FFE6F2F3",
  head: "FF0A8291",
  zebra: "FFF6FAFB",
  line: "FFDCE7E8",
  ink: "FF0E3238",
  muted: "FF5E7A7D",
  white: "FFFFFFFF",
  green: "FF15803D",
  red: "FFC62828",
};

const thin = { style: "thin", color: { argb: C.line } };
const boxBorder = { top: thin, left: thin, bottom: thin, right: thin };
const fmtInt = "#,##0";
const fmtPct = '0.0"%"';

const colToNum = (letters) => [...letters].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0);
const parseA1 = (a1) => { const m = a1.match(/^([A-Z]+)(\d+)$/); return { col: colToNum(m[1]), row: Number(m[2]) }; };
function fillRange(ws, range, argb) {
  const [a, b] = range.split(":");
  const s = parseA1(a);
  const e = parseA1(b);
  for (let r = s.row; r <= e.row; r += 1) {
    for (let c = s.col; c <= e.col; c += 1) {
      ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
    }
  }
}

// Header tabel bergaya: fill teal, teks putih tebal, border, filter, freeze.
function styleTable(ws, headerRowIdx, colCount, firstDataRow, lastDataRow) {
  const hr = ws.getRow(headerRowIdx);
  hr.height = 22;
  for (let c = 1; c <= colCount; c += 1) {
    const cell = hr.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.head } };
    cell.font = { bold: true, color: { argb: C.white }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: cell.alignment?.horizontal || "left" };
    cell.border = boxBorder;
  }
  for (let r = firstDataRow; r <= lastDataRow; r += 1) {
    const row = ws.getRow(r);
    const zebra = (r - firstDataRow) % 2 === 1;
    for (let c = 1; c <= colCount; c += 1) {
      const cell = row.getCell(c);
      cell.border = boxBorder;
      if (zebra) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.zebra } };
      if (!cell.font) cell.font = { color: { argb: C.ink }, size: 10.5 };
    }
  }
  ws.views = [{ state: "frozen", ySplit: headerRowIdx, showGridLines: false }];
  if (lastDataRow >= firstDataRow) {
    ws.autoFilter = { from: { row: headerRowIdx, column: 1 }, to: { row: headerRowIdx, column: colCount } };
  }
}

// Fungsi: buildBranchReportWorkbook
// Input: { account:{nama_cabang,tiktok_username}, month, generatedAt(ISO),
//          cs, growth, vr, insights, content[], history[], viewers[] }.
// Output: ExcelJS.Workbook.
export function buildBranchReportWorkbook({ account, month, generatedAt, cs, growth, vr, insights, history = [], viewers = [] }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Elio Sosmed Analyst";
  wb.created = new Date(generatedAt || Date.now());

  // ── Sheet RINGKASAN ────────────────────────────────────────────────────────
  const ws = wb.addWorksheet("Ringkasan", { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 3 }, { width: 26 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 3 }];

  // Judul (band teal B2:F3)
  ws.mergeCells("B2:F3");
  fillRange(ws, "B2:F3", C.teal);
  const title = ws.getCell("B2");
  title.value = `Laporan Kinerja — ${account.nama_cabang}`;
  title.font = { bold: true, size: 18, color: { argb: C.white } };
  title.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  ws.mergeCells("B4:F4");
  fillRange(ws, "B4:F4", C.tealDark);
  const sub = ws.getCell("B4");
  const periodeTxt = month ? `Periode ${month}` : "Sepanjang masa";
  const genTxt = new Date(generatedAt || Date.now()).toISOString().slice(0, 10);
  sub.value = `@${account.tiktok_username}  ·  ${periodeTxt}  ·  Dibuat ${genTxt}`;
  sub.font = { color: { argb: C.white }, size: 10 };
  sub.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(4).height = 18;

  // KPI cards (2 baris × 3): label kecil + angka besar, kotak ber-fill lembut.
  const kpis = [
    { label: "Total Konten", value: cs.totalVideos, fmt: fmtInt },
    { label: "Total Views", value: cs.totalViews, fmt: fmtInt },
    { label: "Engagement Rate", value: cs.engagementRateOverall, fmt: fmtPct },
    { label: "Net Follower", value: growth.netGrowth, fmt: fmtInt },
    { label: "Rata-rata Views/Konten", value: cs.avgViewsPerPost, fmt: fmtInt },
    { label: "Penonton Baru", value: vr.newPct, fmt: fmtPct },
  ];
  let kr = 6;
  for (let i = 0; i < kpis.length; i += 1) {
    const rowBlock = Math.floor(i / 3);
    const colIdx = i % 3;
    const topRow = 6 + rowBlock * 3;
    const colLetter = ["B", "D", "F"][colIdx];
    const nextLetter = ["C", "E", "G"][colIdx];
    const rng = `${colLetter}${topRow}:${nextLetter}${topRow + 1}`;
    ws.mergeCells(rng);
    fillRange(ws, rng, C.tealSoft);
    const cell = ws.getCell(`${colLetter}${topRow}`);
    const val = kpis[i].fmt === fmtPct ? `${Number(kpis[i].value || 0).toFixed(1)}%` : Number(kpis[i].value || 0).toLocaleString("id-ID");
    cell.value = `${kpis[i].label}\n${val}`;
    cell.font = { size: 10, color: { argb: C.muted } };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
    cell.border = boxBorder;
    // Baris kedua (angka) — pakai rich text supaya besar.
    cell.value = { richText: [
      { text: `${kpis[i].label}\n`, font: { size: 9, color: { argb: C.muted }, bold: true } },
      { text: val, font: { size: 16, bold: true, color: { argb: C.teal } } },
    ] };
    ws.getRow(topRow).height = 20;
    ws.getRow(topRow + 1).height = 20;
  }
  kr = 6 + Math.ceil(kpis.length / 3) * 3 + 1;

  // Ringkasan follower awal→akhir + retensi (baris teks kecil)
  ws.getCell(`B${kr}`).value = `Follower: ${Number(growth.startFollowers || 0).toLocaleString("id-ID")} → ${Number(growth.endFollowers || 0).toLocaleString("id-ID")}   ·   Penonton kembali: ${Number(vr.returningPct || 0).toFixed(1)}%`;
  ws.getCell(`B${kr}`).font = { size: 10, color: { argb: C.ink } };
  kr += 2;

  // Insight (Aspek / Kesimpulan / Saran)
  ws.getCell(`B${kr}`).value = "Insight & Saran";
  ws.getCell(`B${kr}`).font = { bold: true, size: 12, color: { argb: C.tealDark } };
  kr += 1;
  const insHeader = kr;
  ws.getCell(`B${kr}`).value = "Aspek";
  ws.getCell(`C${kr}`).value = "Kesimpulan";
  ws.getCell(`E${kr}`).value = "Saran";
  ws.mergeCells(`C${kr}:D${kr}`);
  ws.mergeCells(`E${kr}:F${kr}`);
  kr += 1;
  const insFirst = kr;
  (insights || []).forEach((it) => {
    ws.getCell(`B${kr}`).value = it.aspek;
    ws.getCell(`B${kr}`).font = { bold: true, size: 10, color: { argb: C.ink } };
    ws.mergeCells(`C${kr}:D${kr}`);
    ws.getCell(`C${kr}`).value = it.kesimpulan;
    ws.getCell(`C${kr}`).alignment = { wrapText: true, vertical: "top" };
    ws.mergeCells(`E${kr}:F${kr}`);
    ws.getCell(`E${kr}`).value = it.saran;
    ws.getCell(`E${kr}`).alignment = { wrapText: true, vertical: "top" };
    ws.getRow(kr).height = 30;
    kr += 1;
  });
  // Style header insight
  ["B", "C", "E"].forEach((c) => {
    const cell = ws.getCell(`${c}${insHeader}`);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.head } };
    cell.font = { bold: true, color: { argb: C.white } };
    cell.border = boxBorder;
  });
  ["D", "F"].forEach((c) => { ws.getCell(`${c}${insHeader}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.head } }; ws.getCell(`${c}${insHeader}`).border = boxBorder; });
  for (let r = insFirst; r < kr; r += 1) {
    ["B", "C", "D", "E", "F"].forEach((c) => { ws.getCell(`${c}${r}`).border = boxBorder; });
  }

  // ── Sheet DATA KONTEN ──────────────────────────────────────────────────────
  const wc = wb.addWorksheet("Data Konten");
  wc.columns = [{ width: 14 }, { width: 10 }, { width: 52 }, { width: 42 }, { width: 12 }, { width: 11 }, { width: 12 }, { width: 11 }, { width: 12 }];
  wc.addRow(["Tanggal Post", "Minggu", "Judul", "Link", "Views", "Likes", "Komentar", "Shares", "Eng. rate"]);
  const cRows = [...(cs.videos || [])].sort((a, b) => String(a.post_date).localeCompare(String(b.post_date)));
  cRows.forEach((v) => {
    const wkNo = v.post_date ? Math.min(5, Math.ceil(Number(String(v.post_date).slice(8, 10)) / 7)) : "-";
    wc.addRow([v.post_date, wkNo === "-" ? "-" : `Minggu ${wkNo}`, v.video_title, v.video_link, v.total_views, v.total_likes, v.total_comments, v.total_shares, v.engagement_rate]);
  });
  [5, 6, 7, 8].forEach((c) => { wc.getColumn(c).numFmt = fmtInt; wc.getColumn(c).alignment = { horizontal: "right" }; });
  wc.getColumn(9).numFmt = fmtPct;
  styleTable(wc, 1, 9, 2, wc.rowCount);

  // ── Sheet FOLLOWER ─────────────────────────────────────────────────────────
  const wf = wb.addWorksheet("Follower");
  wf.columns = [{ width: 14 }, { width: 14 }, { width: 16 }];
  wf.addRow(["Tanggal", "Followers", "Selisih Harian"]);
  (history || []).forEach((r) => {
    const row = wf.addRow([r.date, r.followers, r.diff_from_previous_day]);
    const d = Number(r.diff_from_previous_day) || 0;
    if (d !== 0) row.getCell(3).font = { color: { argb: d > 0 ? C.green : C.red }, bold: true };
  });
  [2, 3].forEach((c) => { wf.getColumn(c).numFmt = fmtInt; wf.getColumn(c).alignment = { horizontal: "right" }; });
  styleTable(wf, 1, 3, 2, wf.rowCount);

  // ── Sheet VIEWERS ──────────────────────────────────────────────────────────
  const wv = wb.addWorksheet("Viewers");
  wv.columns = [{ width: 14 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 14 }];
  wv.addRow(["Tanggal", "Total", "Baru", "Kembali", "Belum Lengkap"]);
  (viewers || []).forEach((r) => wv.addRow([r.date, r.total_viewers, r.new_viewers, r.returning_viewers, r.is_incomplete ? "ya" : ""]));
  [2, 3, 4].forEach((c) => { wv.getColumn(c).numFmt = fmtInt; wv.getColumn(c).alignment = { horizontal: "right" }; });
  styleTable(wv, 1, 5, 2, wv.rowCount);

  return wb;
}

export default buildBranchReportWorkbook;
