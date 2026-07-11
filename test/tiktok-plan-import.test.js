// File: test/tiktok-plan-import.test.js
// Tes parser import Excel Rencana Konten (lib/tiktok/plan-import.js). Membuat workbook
// di memori lalu memastikan header longgar, format tanggal, ACC, & baris kosong benar.

const ExcelJS = require("exceljs");
const { parsePlanWorkbook, cellToDate, cellToBool, normHeader, summarizeOutlets, monthFromLabel } = require("../lib/tiktok/plan-import.js");

let pass = 0;
let fail = 0;
function ok(name, cond) { if (cond) { pass += 1; console.log(`  ok  ${name}`); } else { fail += 1; console.log(`FAIL  ${name}`); } }
function eq(name, got, want) { ok(name, JSON.stringify(got) === JSON.stringify(want)); if (JSON.stringify(got) !== JSON.stringify(want)) console.log(`       got : ${JSON.stringify(got)}\n       want: ${JSON.stringify(want)}`); }

console.log("== helper murni ==");
eq("normHeader rapikan spasi/kapital", normHeader("  Tanggal   POST "), "tanggal post");
eq("normHeader garis miring jadi spasi", normHeader("Headline / Hook"), "headline hook");
eq("cellToDate YYYY-MM-DD", cellToDate("2026-07-15"), "2026-07-15");
eq("cellToDate DD/MM/YYYY", cellToDate("05/07/2026"), "2026-07-05");
eq("cellToDate Date object (UTC, tidak geser)", cellToDate(new Date(Date.UTC(2026, 6, 15))), "2026-07-15");
eq("cellToDate sampah -> null", cellToDate("bukan tanggal"), null);
ok("cellToBool 'Ya' true", cellToBool("Ya") === true);
ok("cellToBool 'ACC' true", cellToBool("ACC") === true);
ok("cellToBool kosong false", cellToBool("") === false);
ok("cellToBool 'tidak' false", cellToBool("tidak") === false);
eq("cellToDate format panjang JS (UTC tidak geser)", cellToDate("Tue Apr 14 2026 07:00:00 GMT+0700 (Western Indonesia Time)"), "2026-04-14");
eq("cellToDate angka polos '2026' -> null (bukan tanggal)", cellToDate("2026"), null);
eq("monthFromLabel 'Juli 2026'", monthFromLabel("Juli 2026"), "2026-07-01");
eq("monthFromLabel 'April 2026'", monthFromLabel("April 2026"), "2026-04-01");
eq("monthFromLabel dari tanggal", monthFromLabel("2026-09-15"), "2026-09-01");
eq("monthFromLabel sampah -> null", monthFromLabel("halo"), null);

console.log("== summarizeOutlets ==");
{
  const recs = [{ outlet: "ELIO" }, { outlet: "ELIO" }, { outlet: "" }, { outlet: "Golio" }];
  eq("hitung & urut per jumlah", summarizeOutlets(recs), [{ value: "ELIO", count: 2 }, { value: "", count: 1 }, { value: "Golio", count: 1 }]);
}

// Bangun workbook uji: header persis template + variasi.
async function buildBuffer(headers, rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Rencana");
  ws.addRow(headers);
  rows.forEach((r) => ws.addRow(r));
  return wb.xlsx.writeBuffer();
}

(async () => {
  console.log("\n== parsePlanWorkbook: happy path ==");
  {
    const headers = ["No", "Tanggal Post", "PIC", "Headline / Hook", "Topic / Redaksi", "Goals Content", "Primary Pillar", "Secondary Pillar", "Type of Content", "Reference Content", "Link Tayang", "Keterangan", "ACC"];
    const rows = [
      [1, "2026-07-15", "Budi", "Promo akhir pekan", "Footage kafe", "Awareness", "Entertainment", "Education", "Video", "https://ref/1", "", "catatan", "Ya"],
      [2, "05/07/2026", "Sari", "Behind the scene", "", "Engagement", "Education", "", "Photo", "", "", "", "tidak"],
      ["", "", "", "", "", "", "", "", "", "", "", "", ""], // baris kosong -> dilewati
    ];
    const buf = await buildBuffer(headers, rows);
    const { records, skippedEmpty } = await parsePlanWorkbook(buf, { fallbackMonth: "2026-07-01" });
    eq("2 baris terparse (1 kosong dilewati)", records.length, 2);
    eq("skippedEmpty = 1", skippedEmpty, 1);
    eq("baris1 tanggal & plan_month", [records[0].post_date, records[0].plan_month], ["2026-07-15", "2026-07-01"]);
    eq("baris1 field lengkap", [records[0].seq, records[0].pic, records[0].headline, records[0].goals_content, records[0].primary_pillar, records[0].content_type], [1, "Budi", "Promo akhir pekan", "Awareness", "Entertainment", "Video"]);
    ok("baris1 ACC 'Ya' -> true", records[0].acc_to_posting === true);
    eq("baris2 DD/MM/YYYY -> ISO", records[1].post_date, "2026-07-05");
    ok("baris2 ACC 'tidak' -> false", records[1].acc_to_posting === false);
    eq("baris2 secondary kosong -> null", records[1].secondary_pillar, null);
    ok("status_override selalu null", records[0].status_override === null && records[1].status_override === null);
  }

  console.log("\n== header longgar (kapital/EN, urutan beda) ==");
  {
    const headers = ["tgl", "HEADLINE", "type", "acc to posting"]; // alias + urutan beda
    const rows = [["2026-08-01", "Judul X", "Reels", "1"]];
    const buf = await buildBuffer(headers, rows);
    const { records } = await parsePlanWorkbook(buf);
    eq("tanggal dari alias 'tgl'", records[0].post_date, "2026-08-01");
    eq("headline dari 'HEADLINE'", records[0].headline, "Judul X");
    eq("type dari 'type'", records[0].content_type, "Reels");
    ok("acc '1' -> true", records[0].acc_to_posting === true);
    eq("plan_month ikut tanggal", records[0].plan_month, "2026-08-01");
  }

  console.log("\n== fallbackMonth saat tanggal kosong tapi headline ada ==");
  {
    const headers = ["Headline / Hook", "PIC"];
    const rows = [["Konten tanpa tanggal", "Andi"]];
    const buf = await buildBuffer(headers, rows);
    const { records } = await parsePlanWorkbook(buf, { fallbackMonth: "2026-09-01" });
    eq("1 baris (headline cukup walau tak ada tanggal)", records.length, 1);
    eq("post_date null", records[0].post_date, null);
    eq("plan_month pakai fallback", records[0].plan_month, "2026-09-01");
  }

  console.log("\n== layout ASLI: banner baris 1, header baris 2, header ganda, kolom Outlet ==");
  {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Content Plan");
    ws.addRow(["Content Planning", "Content Planning", "Content Planning", "Content Planning", "Content Planning", "Content Planning"]); // banner row 1
    ws.addRow(["No", "Post", "PIC", "Headline/Hook", "ACC to POSTING", "Outlet"]); // header asli row 2
    ws.addRow(["No", "Post", "PIC", "Headline/Hook", "ACC to POSTING", "Outlet"]); // HEADER GANDA -> harus dilewati
    ws.addRow([1, "Tue Apr 14 2026 07:00:00 GMT+0700 (Western Indonesia Time)", "DHYAS", "Family Cafe", "false", ""]);
    ws.addRow([2, "2026-07-09", "ENDIN", "Barista ELIO", "true", "ELIO"]);
    ws.addRow(["", "", "", "", "", ""]); // kosong
    const buf = await wb.xlsx.writeBuffer();
    const { records, skippedEmpty, headerRowIndex, sheetUsed } = await parsePlanWorkbook(buf);
    eq("header terdeteksi di baris 2", headerRowIndex, 2);
    eq("sheetUsed", sheetUsed, "Content Plan");
    eq("2 baris data (header ganda & kosong dilewati)", records.length, 2);
    eq("skippedEmpty = 1", skippedEmpty, 1);
    eq("baris1 tanggal format panjang", records[0].post_date, "2026-04-14");
    eq("baris1 outlet kosong", records[0].outlet, "");
    eq("baris2 outlet ELIO", records[1].outlet, "ELIO");
    ok("baris2 acc true", records[1].acc_to_posting === true);
    eq("ringkas outlet", summarizeOutlets(records), [{ value: "", count: 1 }, { value: "ELIO", count: 1 }]);
  }

  console.log("\n== pilih sheet tertentu (sheetName) & pickDefault hindari BANK/Report ==");
  {
    const wb = new ExcelJS.Workbook();
    const rep = wb.addWorksheet("Sosmed Report");
    rep.addRow(["No", "Bulan", "Headline/Hook", "Views"]);
    rep.addRow([1, "April 2026", "konten lama", 100]);
    const cp = wb.addWorksheet("Content Plan Juli");
    cp.addRow(["No", "Post", "Headline/Hook", "Outlet"]);
    cp.addRow([1, "2026-07-09", "rencana juli", "ELIO"]);
    const buf = await wb.xlsx.writeBuffer();
    const def = await parsePlanWorkbook(buf); // default harus pilih "Content Plan Juli", bukan Report
    eq("default pilih sheet content plan", def.sheetUsed, "Content Plan Juli");
    eq("sheetNames lengkap", def.sheetNames, ["Sosmed Report", "Content Plan Juli"]);
    eq("default records dari Juli", def.records.length, 1);
    const rp = await parsePlanWorkbook(buf, { sheetName: "Sosmed Report" });
    eq("bisa pilih sheet Report eksplisit", [rp.sheetUsed, rp.records.length], ["Sosmed Report", 1]);
    eq("Report: month_label -> plan_month (tanpa tanggal)", rp.records[0].plan_month, "2026-04-01");
  }

  console.log("\n== koreksi typo TAHUN via kolom Bulan ==");
  {
    const headers = ["Post", "Bulan", "Headline/Hook"];
    const rows = [
      ["Tue Jul 15 2025 07:00:00 GMT+0700 (Western Indonesia Time)", "Juli 2026", "typo tahun"], // 2025 padahal Bulan 2026 -> koreksi
      ["2026-07-10", "Juli 2026", "tahun sudah benar"],                                          // cocok -> biarkan
      ["2026-08-01", "Juli 2026", "bulan beda"],                                                 // bulan beda -> JANGAN dikoreksi
    ];
    const buf = await buildBuffer(headers, rows);
    const { records } = await parsePlanWorkbook(buf);
    eq("typo 2025 -> dikoreksi ke 2026", [records[0].post_date, records[0].plan_month], ["2026-07-15", "2026-07-01"]);
    eq("tahun benar -> tetap", records[1].post_date, "2026-07-10");
    eq("bulan beda -> tanggal apa adanya", [records[2].post_date, records[2].plan_month], ["2026-08-01", "2026-08-01"]);
  }

  console.log("\n== header tak dikenali -> error ==");
  {
    const buf = await buildBuffer(["kolomA", "kolomB"], [["x", "y"]]);
    let threw = false;
    try { await parsePlanWorkbook(buf); } catch { threw = true; }
    ok("lempar error saat header asing", threw);
  }

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  process.exit(fail === 0 ? 0 : 1);
})();
