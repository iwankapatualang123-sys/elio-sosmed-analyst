// File: test/tiktok-sync.test.js
// Tujuan: regression test untuk lib/tiktok/sync.js memakai client Supabase TIRUAN
// (mock) — menguji hitung baru vs diperbarui, penempelan tiktok_account_id,
// target onConflict, dan penanganan error tanpa perlu jaringan/DB nyata.
// Jalankan: npm run test:sync  (atau: node test/tiktok-sync.test.js)

const S = require('../lib/tiktok/sync.js');

let pass = 0;
let fail = 0;
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass += 1; console.log(`  ok  ${name}`); }
  else { fail += 1; console.log(`FAIL  ${name}\n       got : ${JSON.stringify(got)}\n       want: ${JSON.stringify(want)}`); }
}

const ACC = '00000000-0000-0000-0000-000000000001';

// Client Supabase tiruan. `existing` = baris yang dianggap sudah ada di DB per tabel.
function makeMock({ existing = {}, failUpsertOn = null, failSelectOn = null } = {}) {
  const calls = { upserts: [], selects: [] };
  function from(table) {
    const state = { table, filters: {} };
    const builder = {
      select(cols) { state.cols = cols; return builder; },
      eq(col, val) { state.filters[col] = val; return builder; },
      in(col, vals) {
        calls.selects.push({ table, col, vals });
        if (failSelectOn === table) return Promise.resolve({ data: null, error: { message: 'boom select' } });
        const rows = (existing[table] || []).filter(
          (r) => vals.includes(r[col])
            && (state.filters.tiktok_account_id === undefined || r.tiktok_account_id === state.filters.tiktok_account_id),
        );
        return Promise.resolve({ data: rows, error: null });
      },
      upsert(rows, opts) {
        calls.upserts.push({ table, rows, opts });
        if (failUpsertOn === table) return Promise.resolve({ error: { message: 'boom upsert' } });
        return Promise.resolve({ error: null });
      },
    };
    return builder;
  }
  return { from, _calls: calls };
}

function contentResult() {
  return {
    fileType: 'content', filename: 'Content.xlsx',
    rows: [
      { video_id: '111', total_views: 10 },
      { video_id: '222', total_views: 20 },
    ],
    warnings: [], stats: { parsed: 2, flagged: 0, skipped: 1 },
  };
}

(async () => {
  console.log('== content: 1 existing -> added=1, updated=1 ==');
  {
    const mock = makeMock({ existing: { tiktok_content: [{ tiktok_account_id: ACC, video_id: '111' }] } });
    const sum = await S.syncParseResult(mock, ACC, contentResult());
    eq('added', sum.added, 1);
    eq('updated', sum.updated, 1);
    eq('table', sum.table, 'tiktok_content');
    eq('skipped passthrough', sum.skipped, 1);
    eq('no error', sum.error, null);
    eq('upsert dipanggil sekali', mock._calls.upserts.length, 1);
    eq('onConflict benar', mock._calls.upserts[0].opts.onConflict, 'tiktok_account_id,video_id');
    eq('account_id ditempel', mock._calls.upserts[0].rows.every((r) => r.tiktok_account_id === ACC), true);
    eq('semua baris ikut ter-upsert', mock._calls.upserts[0].rows.length, 2);
  }

  console.log('== content: semua baru -> added=2, updated=0 ==');
  {
    const mock = makeMock({ existing: {} });
    const sum = await S.syncParseResult(mock, ACC, contentResult());
    eq('added', sum.added, 2);
    eq('updated', sum.updated, 0);
  }

  console.log('== territories: composite key (snapshot_date, territory_code) ==');
  {
    const res = {
      fileType: 'follower_territories', filename: 'FollowerTopTerritories.xlsx',
      rows: [
        { snapshot_date: '2026-07-09', territory_code: 'ID', distribution_pct: 80 },
        { snapshot_date: '2026-07-09', territory_code: 'MY', distribution_pct: 5 },
      ],
      warnings: [], stats: { parsed: 2, flagged: 0, skipped: 0 },
    };
    const mock = makeMock({ existing: { tiktok_follower_territories: [{ tiktok_account_id: ACC, snapshot_date: '2026-07-09', territory_code: 'ID' }] } });
    const sum = await S.syncParseResult(mock, ACC, res);
    eq('added (MY baru)', sum.added, 1);
    eq('updated (ID lama)', sum.updated, 1);
    eq('onConflict komposit', mock._calls.upserts[0].opts.onConflict, 'tiktok_account_id,snapshot_date,territory_code');
  }

  console.log('== tanpa accountId -> error, tidak ada upsert ==');
  {
    const mock = makeMock();
    const sum = await S.syncParseResult(mock, null, contentResult());
    eq('ada error', typeof sum.error === 'string' && sum.error.length > 0, true);
    eq('tidak upsert', mock._calls.upserts.length, 0);
  }

  console.log('== fileType tidak dikenal -> di-skip, tidak ada DB call ==');
  {
    const mock = makeMock();
    const sum = await S.syncParseResult(mock, ACC, { fileType: null, filename: 'notes.txt', rows: [], warnings: [], stats: { skipped: 0 } });
    eq('table null', sum.table, null);
    eq('tidak upsert', mock._calls.upserts.length, 0);
    eq('tidak select', mock._calls.selects.length, 0);
  }

  console.log('== error upsert -> ditangkap di summary.error ==');
  {
    const mock = makeMock({ failUpsertOn: 'tiktok_content' });
    const sum = await S.syncParseResult(mock, ACC, contentResult());
    eq('error terisi', /boom upsert/.test(sum.error || ''), true);
    eq('added direset', sum.added, 0);
    eq('updated direset', sum.updated, 0);
  }

  console.log('== syncParseResults: agregasi total ==');
  {
    const mock = makeMock({ existing: { tiktok_content: [{ tiktok_account_id: ACC, video_id: '111' }] } });
    const overview = {
      fileType: 'overview', filename: 'Overview.xlsx',
      rows: [{ date: '2026-07-01', video_views: 5 }],
      warnings: [], stats: { parsed: 1, flagged: 0, skipped: 0 },
    };
    const { perFile, totals } = await S.syncParseResults(mock, ACC, [contentResult(), overview]);
    eq('2 file', perFile.length, 2);
    eq('total added', totals.added, 1 + 1); // content:1 baru + overview:1 baru
    eq('total updated', totals.updated, 1); // content: 111 update
    eq('total skipped', totals.skipped, 1); // dari stats content
    eq('failed 0', totals.failed, 0);
  }

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  process.exit(fail === 0 ? 0 : 1);
})();
