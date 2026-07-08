// File: test/tiktok-upload.test.js
// Tujuan: regression test untuk lib/tiktok/upload.js. Zip dibuat in-memory pakai
// fflate (termasuk zip BERSARANG) + xlsx dibuat pakai exceljs, jadi portable
// (tidak bergantung file di disk). Sync dites pakai client Supabase tiruan.
// Jalankan: npm run test:upload.

const ExcelJS = require('exceljs');
const { zipSync } = require('fflate');
const U = require('../lib/tiktok/upload.js');

let pass = 0;
let fail = 0;
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass += 1; console.log(`  ok  ${name}`); }
  else { fail += 1; console.log(`FAIL  ${name}\n       got : ${JSON.stringify(got)}\n       want: ${JSON.stringify(want)}`); }
}

// Bangun xlsx (Uint8Array) sederhana.
async function xlsx(sheet, headers, rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheet);
  ws.addRow(headers);
  rows.forEach((r) => ws.addRow(r));
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

// Client Supabase tiruan: tidak ada data existing -> semua dianggap baru.
function makeMock() {
  const calls = { upserts: [] };
  function from(table) {
    const b = {
      select() { return b; },
      eq() { return b; },
      in() { return Promise.resolve({ data: [], error: null }); },
      upsert(rows, opts) { calls.upserts.push({ table, rows, opts }); return Promise.resolve({ error: null }); },
    };
    return b;
  }
  return { from, _calls: calls };
}

const ACC = { id: '00000000-0000-0000-0000-000000000001', tiktok_username: 'elioagency' };

(async () => {
  console.log('== detectUsernameFromFilename ==');
  eq('Content_elioagency.zip', U.detectUsernameFromFilename('Content_elioagency.zip'), 'elioagency');
  eq('Overview_<date>_<id>_user', U.detectUsernameFromFilename('Overview_2026-06-09_1783356516_elioagency.zip'), 'elioagency');
  eq('duplikat (1)', U.detectUsernameFromFilename('Content_elioagency (1).zip'), 'elioagency');
  eq('xlsx polos -> null', U.detectUsernameFromFilename('Content.xlsx'), null);
  eq('tanpa underscore -> null', U.detectUsernameFromFilename('randomfile.zip'), null);

  // Siapkan buffer
  const contentXlsx = await xlsx('Content',
    ['Time', 'Video title', 'Video link', 'Post time', 'Total likes', 'Total comments', 'Total shares', 'Total views'],
    [['8 Juli', 'judul', 'https://www.tiktok.com/@elioagency/video/7647134669963529479', '3 Juni', 25, 7, 2, 1534]]);
  const overviewXlsx = await xlsx('Overview',
    ['Date', 'Video Views', 'Profile Views', 'Likes', 'Comments', 'Shares'],
    [['9 Juni', 82, 4, 0, 0, 1]]);
  const genderXlsx = await xlsx('FollowerGender', ['Gender', 'Distribution'], [['Male', 0.6], ['Female', 0.4]]);

  console.log('== extractXlsxFiles ==');
  {
    // xlsx langsung
    const r1 = U.extractXlsxFiles([{ filename: 'Content.xlsx', buffer: contentXlsx }]);
    eq('xlsx langsung', r1.files.length, 1);

    // zip berisi xlsx
    const contentZip = zipSync({ 'Content.xlsx': contentXlsx });
    const r2 = U.extractXlsxFiles([{ filename: 'Content_elioagency.zip', buffer: contentZip }]);
    eq('zip -> 1 xlsx', r2.files.length, 1);
    eq('nama file dalam zip', r2.files[0].filename, 'Content.xlsx');

    // zip BERSARANG: bundle.zip -> Followers.zip -> FollowerGender.xlsx
    const innerZip = zipSync({ 'FollowerGender.xlsx': genderXlsx });
    const bundleZip = zipSync({ 'Followers.zip': innerZip });
    const r3 = U.extractXlsxFiles([{ filename: 'bundle.zip', buffer: bundleZip }]);
    eq('zip bersarang -> xlsx ketemu', r3.files.length, 1);
    eq('nama xlsx bersarang', r3.files[0].filename, 'FollowerGender.xlsx');

    // file tak dikenal & rar
    const r4 = U.extractXlsxFiles([{ filename: 'catatan.txt', buffer: Buffer.from('halo') }]);
    eq('txt -> 0 file + warning', [r4.files.length, r4.warnings.length > 0], [0, true]);
    const r5 = U.extractXlsxFiles([{ filename: 'data.rar', buffer: Buffer.from('Rar!') }]);
    eq('rar -> warning khusus', /\.rar belum didukung/.test(r5.warnings.join(' ')), true);
  }

  console.log('== processUpload (mock supabase) ==');
  {
    const contentZip = zipSync({ 'Content.xlsx': contentXlsx });
    const overviewZip = zipSync({ 'Overview.xlsx': overviewXlsx });
    const mock = makeMock();
    const res = await U.processUpload(mock, ACC, [
      { filename: 'Content_elioagency.zip', buffer: contentZip },
      { filename: 'Overview_2026-06-09_1783356516_elioagency.zip', buffer: overviewZip },
    ], {});
    eq('ok', res.ok, true);
    eq('2 file diproses', res.perFile.length, 2);
    eq('total added', res.totals.added, 2);
    eq('failed 0', res.totals.failed, 0);
    eq('tidak ada mismatch', res.usernameMismatch, false);
    eq('upsert ke 2 tabel', mock._calls.upserts.map((u) => u.table).sort(), ['tiktok_content', 'tiktok_daily_overview']);
  }

  console.log('== processUpload: peringatan salah cabang ==');
  {
    const contentZip = zipSync({ 'Content.xlsx': contentXlsx });
    const res = await U.processUpload(makeMock(), { id: ACC.id, tiktok_username: 'akunlain' },
      [{ filename: 'Content_elioagency.zip', buffer: contentZip }], {});
    eq('usernameMismatch true', res.usernameMismatch, true);
    eq('ada warning mismatch', /salah cabang/.test(res.warnings.join(' ')), true);
    eq('tetap diproses', res.perFile.length, 1);
  }

  console.log('== processUpload: tidak ada xlsx ==');
  {
    const res = await U.processUpload(makeMock(), ACC, [{ filename: 'catatan.txt', buffer: Buffer.from('x') }], {});
    eq('ok false', res.ok, false);
    eq('0 file', res.perFile.length, 0);
  }

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  process.exit(fail === 0 ? 0 : 1);
})();
