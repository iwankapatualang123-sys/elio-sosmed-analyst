// File: test/tiktok-metrics.test.js
// Tujuan: regression test untuk lib/tiktok/metrics.js dengan data sintetis
// berisi angka yang hasilnya diketahui. Jalankan: npm run test:metrics.

const M = require('../lib/tiktok/metrics.js');

let pass = 0;
let fail = 0;
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass += 1; console.log(`  ok  ${name}`); }
  else { fail += 1; console.log(`FAIL  ${name}\n       got : ${JSON.stringify(got)}\n       want: ${JSON.stringify(want)}`); }
}

console.log('== videoEngagement ==');
eq('rate 20%', M.videoEngagement({ total_views: 100, total_likes: 10, total_comments: 5, total_shares: 5 }), { total_engagement: 20, engagement_rate: 20 });
eq('views 0 -> rate 0', M.videoEngagement({ total_views: 0, total_likes: 5 }), { total_engagement: 5, engagement_rate: 0 });

const content = [
  { video_id: 'a', video_title: '#fyp #malang keren', post_date: '2026-07-01', total_views: 100, total_likes: 10, total_comments: 5, total_shares: 5 },
  { video_id: 'b', video_title: '#fyp #Malang mantap', post_date: '2026-07-15', total_views: 300, total_likes: 20, total_comments: 10, total_shares: 0 },
  { video_id: 'c', video_title: 'tanpa tag', post_date: '2026-06-20', total_views: 50, total_likes: 1, total_comments: 0, total_shares: 0 },
];

console.log('== summarizeContent ==');
{
  const s = M.summarizeContent(content);
  eq('totalVideos', s.totalVideos, 3);
  eq('totalViews', s.totalViews, 450);
  eq('totalEngagement', s.totalEngagement, 51);
  eq('avgViewsPerPost', s.avgViewsPerPost, 150);
  eq('engagementRateOverall', s.engagementRateOverall, round(51 / 450 * 100));
  eq('video a diperkaya', s.videos[0].engagement_rate, 20);
}

console.log('== rankVideos ==');
{
  const enriched = M.summarizeContent(content).videos;
  eq('top views', M.rankVideos(enriched, { by: 'views', limit: 1 })[0].video_id, 'b');
  eq('top engagement_rate', M.rankVideos(enriched, { by: 'engagement_rate', limit: 1 })[0].video_id, 'a');
  eq('bottom views', M.rankVideos(enriched, { by: 'views', order: 'asc', limit: 1 })[0].video_id, 'c');
  eq('input tidak berubah', enriched[0].video_id, 'a');
}

console.log('== contentPerMonth ==');
eq('grup bulan', M.contentPerMonth(content), [
  { month: '2026-06', count: 1, totalViews: 50 },
  { month: '2026-07', count: 2, totalViews: 400 },
]);

console.log('== hashtag ==');
eq('extractHashtags lowercase', M.extractHashtags('Halo #FYP #Malang #malang'), ['#fyp', '#malang', '#malang']);
{
  const h = M.hashtagStats(content);
  eq('2 hashtag unik', h.length, 2);
  const fyp = h.find((x) => x.hashtag === '#fyp');
  eq('#fyp count', fyp.count, 2);
  eq('#fyp totalViews', fyp.totalViews, 400);
  eq('#fyp avgViews', fyp.avgViews, 200);
}

console.log('== followerGrowth ==');
{
  const fg = M.followerGrowth([
    { date: '2026-07-02', followers: 110, diff_from_previous_day: 10 },
    { date: '2026-07-01', followers: 100, diff_from_previous_day: 0 },
    { date: '2026-07-04', followers: 130, diff_from_previous_day: 25 },
    { date: '2026-07-03', followers: 105, diff_from_previous_day: -5 },
  ]);
  eq('netGrowth', fg.netGrowth, 30);
  eq('startFollowers', fg.startFollowers, 100);
  eq('endFollowers', fg.endFollowers, 130);
  eq('gained', fg.gained, 35);
  eq('lost', fg.lost, 5);
  eq('bestDay', fg.bestDay, { date: '2026-07-04', diff: 25 });
  eq('worstDay', fg.worstDay, { date: '2026-07-03', diff: -5 });
  eq('days', fg.days, 4);
}

console.log('== viewersRatio (kecualikan incomplete) ==');
{
  const vr = M.viewersRatio([
    { new_viewers: 30, returning_viewers: 10, total_viewers: 40, is_incomplete: false },
    { new_viewers: 20, returning_viewers: 20, total_viewers: 40, is_incomplete: false },
    { new_viewers: 5, returning_viewers: 0, total_viewers: null, is_incomplete: true },
  ]);
  eq('totalNew', vr.totalNew, 50);
  eq('totalReturning', vr.totalReturning, 30);
  eq('newPct', vr.newPct, 62.5);
  eq('returningPct', vr.returningPct, 37.5);
  eq('daysCounted', vr.daysCounted, 2);
  eq('daysIncomplete', vr.daysIncomplete, 1);
}

console.log('== bestPostingTimes ==');
{
  const bt = M.bestPostingTimes([
    { date: '2026-07-01', hour: 9, active_followers: 100 },
    { date: '2026-07-02', hour: 9, active_followers: 200 },
    { date: '2026-07-01', hour: 20, active_followers: 50 },
  ]);
  eq('byHour 24 entri', bt.byHour.length, 24);
  eq('jam 9 avg', bt.byHour[9], { hour: 9, totalActive: 300, avgActive: 150, days: 2 });
  eq('topHour', bt.topHours[0].hour, 9);
  // heatmapPeak: sel paling ramai. 2026-07-01 = Rabu (weekday 3), 2026-07-02 = Kamis (4).
  const peak = M.heatmapPeak(bt.heatmap);
  eq('heatmapPeak = Kamis jam 9 (active 200)', [peak.weekday, peak.hour, peak.value], [4, 9, 200]);
}
eq('heatmapPeak kosong -> null', M.heatmapPeak({}), null);

console.log('== benchmark & status ==');
eq('naik 20%', M.benchmark(120, 100), { current: 120, previous: 100, deltaAbs: 20, deltaPct: 20, status: 'naik' });
eq('turun', M.benchmark(90, 100).status, 'turun');
eq('stabil', M.benchmark(103, 100).status, 'stabil');
eq('previous 0', M.benchmark(5, 0), { current: 5, previous: 0, deltaAbs: 5, deltaPct: 100, status: 'naik' });
eq('threshold custom', M.benchmark(103, 100, { thresholdPct: 1 }).status, 'naik');
eq('statusFromDelta', M.statusFromDelta(-10), 'turun');

console.log('== accountSummary ==');
{
  const s = M.accountSummary({
    content,
    followerHistory: [{ date: '2026-07-01', followers: 100, diff_from_previous_day: 0 }, { date: '2026-07-04', followers: 130, diff_from_previous_day: 25 }],
    viewers: [{ new_viewers: 30, returning_viewers: 10, total_viewers: 40, is_incomplete: false }],
  });
  eq('totalVideos', s.totalVideos, 3);
  eq('netFollowerGrowth', s.netFollowerGrowth, 30);
  eq('newViewersPct', s.newViewersPct, 75);
}

function round(n) { return Math.round(n * 100) / 100; }

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail === 0 ? 0 : 1);
