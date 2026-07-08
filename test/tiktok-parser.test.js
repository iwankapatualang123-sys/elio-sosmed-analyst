// File: test/tiktok-parser.test.js
// Tujuan: regression test untuk lib/tiktok/parser.js. Membangun buffer .xlsx asli
// pakai exceljs (termasuk anomali TikTok: komentar negatif, sel "undefined",
// tanggal Indonesia tanpa tahun) lalu memverifikasi hasil parse.
// Jalankan: npm run test:parser  (atau: node test/tiktok-parser.test.js)
// Tanpa framework — cukup Node bawaan, exit code 1 kalau ada yang gagal.

const ExcelJS = require('exceljs');
const P = require('../lib/tiktok/parser.js');

let pass = 0;
let fail = 0;
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass += 1; console.log(`  ok  ${name}`); }
  else { fail += 1; console.log(`FAIL  ${name}\n       got : ${JSON.stringify(got)}\n       want: ${JSON.stringify(want)}`); }
}

console.log('== unit: extractVideoId ==');
eq('video url', P.extractVideoId('https://www.tiktok.com/@elio/video/7647134669963529479?lang=en'), '7647134669963529479');
eq('photo url', P.extractVideoId('https://www.tiktok.com/@elio/photo/7123456789012345678'), '7123456789012345678');
eq('raw id', P.extractVideoId('7647134669963529479'), '7647134669963529479');
eq('junk', P.extractVideoId('not a url'), null);
eq('null', P.extractVideoId(null), null);

console.log('== unit: parseIndoDate (ref 2026-07-09) ==');
const ref = new Date(2026, 6, 9);
eq('8 Juli -> infer 2026', P.parseIndoDate('8 Juli', { referenceDate: ref }).iso, '2026-07-08');
eq('20 Desember -> prev year 2025', P.parseIndoDate('20 Desember', { referenceDate: ref }).iso, '2025-12-20');
eq('8 Jul 2024', P.parseIndoDate('8 Jul 2024', { referenceDate: ref }).iso, '2024-07-08');
eq('ISO', P.parseIndoDate('2025-03-14', { referenceDate: ref }).iso, '2025-03-14');
eq('dd/mm/yyyy', P.parseIndoDate('14/03/2025', { referenceDate: ref }).iso, '2025-03-14');
eq('undefined token', P.parseIndoDate('undefined', { referenceDate: ref }), { iso: null, incomplete: true });
eq('Date obj (UTC)', P.parseIndoDate(new Date(Date.UTC(2025, 6, 8)), { referenceDate: ref }).iso, '2025-07-08');

console.log('== unit: parseIntCell ==');
eq('plain', P.parseIntCell(1234), { value: 1234, incomplete: false, negative: false });
eq('thousand sep', P.parseIntCell('1.234'), { value: 1234, incomplete: false, negative: false });
eq('negative comments', P.parseIntCell('-1'), { value: -1, incomplete: false, negative: true });
eq('undefined', P.parseIntCell('undefined'), { value: null, incomplete: true, negative: false });
eq('empty', P.parseIntCell(''), { value: null, incomplete: true, negative: false });

console.log('== unit: parsePctCell ==');
eq('55%', P.parsePctCell('55%'), { value: 55, incomplete: false });
eq('fraction 0.45', P.parsePctCell(0.45), { value: 45, incomplete: false });
eq('comma decimal', P.parsePctCell('12,5%'), { value: 12.5, incomplete: false });

console.log('== unit: parseHour ==');
eq('num 13', P.parseHour(13), 13);
eq('13:00', P.parseHour('13:00'), 13);
eq('1 PM', P.parseHour('1 PM'), 13);
eq('12 AM', P.parseHour('12 AM'), 0);
eq('out of range', P.parseHour(30), null);

console.log('== unit: detectFileType ==');
eq('Content', P.detectFileType('Content_elioagency.xlsx'), 'content');
eq('Overview', P.detectFileType('Overview.xlsx'), 'overview');
eq('FollowerHistory', P.detectFileType('FollowerHistory.xlsx'), 'follower_history');
eq('FollowerGender', P.detectFileType('FollowerGender.xlsx'), 'follower_gender');
eq('TopTerritories', P.detectFileType('FollowerTopTerritories.xlsx'), 'follower_territories');
eq('FollowerActivity', P.detectFileType('FollowerActivity.xlsx'), 'follower_activity');
eq('Viewers', P.detectFileType('Viewers.xlsx'), 'viewers');
eq('unknown', P.detectFileType('RandomFile.xlsx'), null);

// Bangun buffer .xlsx sungguhan (header + baris data, opsional baris preamble).
async function buildXlsx(sheetName, headers, rows, opts = {}) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  if (opts.preamble) ws.addRow([opts.preamble]);
  ws.addRow(headers);
  rows.forEach((r) => ws.addRow(r));
  return wb.xlsx.writeBuffer();
}

(async () => {
  console.log('== e2e: Content.xlsx (hyperlink, komentar negatif, baris preamble) ==');
  const contentBuf = await buildXlsx(
    'Content',
    ['Video Title', 'Video Link', 'Post Date', 'Views', 'Likes', 'Comments', 'Shares'],
    [
      ['Video Bagus', { text: 'link', hyperlink: 'https://www.tiktok.com/@elio/video/7647134669963529479' }, '8 Juli', 12000, 300, -1, 45],
      ['Video Tanpa ID', 'bukan-url', '9 Juli', 500, 10, 2, 1],
    ],
    { preamble: 'Laporan Konten TikTok' },
  );
  const cRes = await P.parseWorkbook(contentBuf, 'Content_elioagency.xlsx', { referenceDate: ref });
  eq('content fileType', cRes.fileType, 'content');
  eq('content rows count (1 skipped)', cRes.rows.length, 1);
  eq('content video_id', cRes.rows[0].video_id, '7647134669963529479');
  eq('content post_date inferred', cRes.rows[0].post_date, '2026-07-08');
  eq('content negative comment preserved', cRes.rows[0].total_comments, -1);
  eq('content stats', cRes.stats, { parsed: 1, flagged: 1, skipped: 1 });

  console.log('== e2e: Viewers.xlsx (undefined -> is_incomplete) ==');
  const vBuf = await buildXlsx(
    'Viewers',
    ['Date', 'Total Viewers', 'New Viewers', 'Returning Viewers'],
    [['7 Juli', 1000, 400, 600], ['8 Juli', 'undefined', 'undefined', 'undefined']],
  );
  const vRes = await P.parseWorkbook(vBuf, 'Viewers.xlsx', { referenceDate: ref });
  eq('viewers row0 complete', vRes.rows[0].is_incomplete, false);
  eq('viewers row1 incomplete', vRes.rows[1].is_incomplete, true);
  eq('viewers row1 null value', vRes.rows[1].total_viewers, null);

  console.log('== e2e: FollowerGender.xlsx (orientasi baris) ==');
  const gBuf = await buildXlsx('Gender', ['Gender', 'Percentage'], [['Female', '62%'], ['Male', '38%']]);
  const gRes = await P.parseWorkbook(gBuf, 'FollowerGender.xlsx', { snapshotDate: '2026-07-09' });
  eq('gender female', gRes.rows[0].female_pct, 62);
  eq('gender male', gRes.rows[0].male_pct, 38);
  eq('gender snapshot_date', gRes.rows[0].snapshot_date, '2026-07-09');

  console.log('== e2e: file tidak dikenal & file rusak tidak bikin crash ==');
  const uRes = await P.parseWorkbook(Buffer.from('not xlsx'), 'notes.txt', {});
  eq('unknown skipped', uRes.skipped, true);
  const badRes = await P.parseWorkbook(Buffer.from('corrupt'), 'Content.xlsx', {});
  eq('corrupt skipped', badRes.skipped, true);

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  process.exit(fail === 0 ? 0 : 1);
})();
