// File: lib/dashboard/umum.js
// Agregasi data untuk halaman Dashboard ▸ Umum (ringkasan SEMUA outlet & SEMUA
// platform). Satu pintu: loadUmum(supabase, { month, cat }). Semua angka lintas
// outlet dikumpulkan di sini supaya page.jsx cukup merender.
//
// Prinsip data per platform (ikut keterbatasan sumber, dijelaskan di UI lewat chip):
//   - TikTok    : punya report lengkap (views, engagement, follower history, gender).
//   - Instagram : punya report konten + metrik harian; follower absolut hanya dari
//                 snapshot manual (social_account_snapshots).
//   - Threads   : hanya snapshot follower manual (tak ada report konten).
// "Total follower" menjumlahkan TikTok (history) + IG + Threads (snapshot). Demografi
// hanya tersedia dari TikTok, jadi diberi label "Sumber: TikTok".

import { erOf, interactionsOf } from "../instagram/metrics.js";
import { extractVideoId, extractIgShortcode } from "../tiktok/content-plan.js";

// Kelompokkan baris per kolom -> Map<key, rows[]> (untuk membagi hasil query .in).
function groupBy(rows, key) {
  const m = new Map();
  for (const r of rows || []) {
    const k = r[key];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}

const monthOf = (d) => (typeof d === "string" ? d.slice(0, 7) : null);
const inMonth = (d, month) => !month || monthOf(d) === month;
// Ambang tayangan minimal utk MASUK ranking ER — supaya konten bertayangan sangat
// kecil (pembagi kecil → ER melambung) tidak menyesatkan. Per platform karena skala
// tayangan TikTok jauh lebih besar dari Instagram.
const ER_MIN_VIEWS = { tiktok: 1000, instagram: 500, threads: 0 };

// TikTok ER 1 konten (%) — likes+comments+shares / views. IG pakai erOf (ada saves).
function ttEr(r) {
  const v = Number(r.total_views) || 0;
  if (v <= 0) return null;
  const eng = (Number(r.total_likes) || 0) + (Number(r.total_comments) || 0) + (Number(r.total_shares) || 0);
  return Math.round((eng / v) * 10000) / 100;
}

// Ambil baris snapshot terbaru (per platform) dari social_account_snapshots.
function latestFollowers(snaps, platform) {
  const rows = (snaps || [])
    .filter((s) => s.platform === platform && s.followers != null)
    .sort((a, b) => String(a.snapshot_date).localeCompare(String(b.snapshot_date)));
  return rows.length ? Number(rows[rows.length - 1].followers) || 0 : null;
}

// Follower ABSOLUT Instagram. Export IG hanya memberi PERTAMBAHAN harian (delta),
// bukan total — jadi butuh 1 angka total sebagai "anchor" (snapshot manual). Begitu
// ada anchor, total terkini = anchor + jumlah pertambahan harian SETELAH tgl anchor
// (jadi tim cukup input follower IG sekali, angka lanjut jalan sendiri dari delta).
// Tanpa anchor sama sekali -> null (tak bisa ditebak dari delta saja).
function igAbsoluteFollowers(snaps, igDaily) {
  const anchors = (snaps || [])
    .filter((s) => s.platform === "instagram" && s.followers != null)
    .sort((a, b) => String(a.snapshot_date).localeCompare(String(b.snapshot_date)));
  if (!anchors.length) return null;
  const anchor = anchors[anchors.length - 1];
  const anchorDate = String(anchor.snapshot_date).slice(0, 10);
  const added = (igDaily || [])
    .filter((r) => r.metric === "new_followers" && String(r.date).slice(0, 10) > anchorDate)
    .reduce((s, r) => s + (Number(r.value) || 0), 0);
  return Math.max(0, (Number(anchor.followers) || 0) + added);
}

// Ambil snapshot gender/territory TERBARU (satu tanggal) dari kumpulan baris.
function latestSnapshotRows(rows, dateKey) {
  const dates = [...new Set((rows || []).map((r) => r[dateKey]).filter(Boolean))].sort();
  if (!dates.length) return [];
  const target = dates[dates.length - 1];
  return (rows || []).filter((r) => r[dateKey] === target);
}

// Fungsi: loadUmum
// Output (async): objek lengkap utk halaman Umum. Semua field siap dirender.
export async function loadUmum(supabase, { month = null, cat = null } = {}) {
  const { data: accounts } = await supabase
    .from("tiktok_accounts")
    .select("id, nama_cabang, tiktok_username, kategori, logo_url")
    .eq("is_active", true)
    .order("nama_cabang");

  const all = accounts || [];
  const categories = [...new Set(all.map((a) => a.kategori).filter(Boolean))];
  // Abaikan kategori tak dikenal (URL basi/typo) supaya halaman tidak jadi separuh
  // kosong (KPI/grafik kosong tapi ranking penuh).
  const effCat = cat && categories.includes(cat) ? cat : null;
  const outlets = effCat ? all.filter((a) => a.kategori === effCat) : all;

  // Ambil data SEMUA outlet dalam SATU query per tabel (.in), lalu bagi per outlet
  // di memori — menghindari N+1 (dulu 9 query per outlet). Skala konstan.
  const ids = outlets.map((o) => o.id);
  const [ttc, igc, hist, snaps, igDaily, gender, terr, plans, igAud] = await Promise.all([
    supabase.from("tiktok_content").select("tiktok_account_id, video_id, video_title, video_link, post_date, total_views, total_likes, total_comments, total_shares").in("tiktok_account_id", ids),
    supabase.from("instagram_content").select("tiktok_account_id, post_id, description, permalink, post_type, published_at, views, likes, comments, shares, saves, is_collab").in("tiktok_account_id", ids),
    supabase.from("tiktok_follower_history").select("tiktok_account_id, date, followers").in("tiktok_account_id", ids),
    supabase.from("social_account_snapshots").select("tiktok_account_id, platform, snapshot_date, followers").in("tiktok_account_id", ids),
    supabase.from("instagram_daily_metrics").select("tiktok_account_id, metric, date, value").in("tiktok_account_id", ids),
    supabase.from("tiktok_follower_gender").select("tiktok_account_id, snapshot_date, male_pct, female_pct, other_pct").in("tiktok_account_id", ids),
    supabase.from("tiktok_follower_territories").select("tiktok_account_id, snapshot_date, territory_code, distribution_pct").in("tiktok_account_id", ids),
    supabase.from("content_plans").select("tiktok_account_id, primary_pillar, posted_url, platform_links, plan_month, post_date").in("tiktok_account_id", ids),
    supabase.from("instagram_audience").select("tiktok_account_id, snapshot_date, female_pct, male_pct").in("tiktok_account_id", ids),
  ]);
  const gTt = groupBy(ttc.data, "tiktok_account_id");
  const gIg = groupBy(igc.data, "tiktok_account_id");
  const gHist = groupBy(hist.data, "tiktok_account_id");
  const gSnap = groupBy(snaps.data, "tiktok_account_id");
  const gDaily = groupBy(igDaily.data, "tiktok_account_id");
  const gGen = groupBy(gender.data, "tiktok_account_id");
  const gTerr = groupBy(terr.data, "tiktok_account_id");
  const gPlan = groupBy(plans.data, "tiktok_account_id");
  const gAud = groupBy(igAud.data, "tiktok_account_id");
  const bundles = outlets.map((acc) => ({
    acc,
    ttContent: gTt.get(acc.id) || [],
    igContent: (gIg.get(acc.id) || []).filter((r) => !r.is_collab),
    igDaily: gDaily.get(acc.id) || [],
    igAudience: gAud.get(acc.id) || [],
    history: gHist.get(acc.id) || [],
    snaps: gSnap.get(acc.id) || [],
    gender: gGen.get(acc.id) || [],
    territories: gTerr.get(acc.id) || [],
    plans: gPlan.get(acc.id) || [],
  }));

  // ---- Follower absolut per outlet per platform (grouped bars) ----
  const followerBars = bundles.map((b) => {
    const h = [...b.history].sort((x, y) => String(x.date).localeCompare(String(y.date)));
    const tiktok = h.length ? Number(h[h.length - 1].followers) || 0 : null;
    const instagram = igAbsoluteFollowers(b.snaps, b.igDaily);
    const threads = latestFollowers(b.snaps, "threads");
    const total = (tiktok || 0) + (instagram || 0) + (threads || 0);
    return { id: b.acc.id, nama: b.acc.nama_cabang, kategori: b.acc.kategori || null, tiktok, instagram, threads, total };
  }).sort((a, b) => b.total - a.total);

  const totalFollower = followerBars.reduce((s, o) => s + o.total, 0);

  // ---- KPI tayangan & ER gabungan (scoped bulan) ----
  let ttViews = 0, ttEng = 0, igViews = 0, igEng = 0, ttCount = 0, igCount = 0;
  for (const b of bundles) {
    for (const r of b.ttContent) {
      if (!inMonth(r.post_date, month)) continue;
      ttCount += 1;
      ttViews += Number(r.total_views) || 0;
      ttEng += (Number(r.total_likes) || 0) + (Number(r.total_comments) || 0) + (Number(r.total_shares) || 0);
    }
    for (const r of b.igContent) {
      if (!inMonth(String(r.published_at).slice(0, 10), month)) continue;
      igCount += 1;
      igViews += Number(r.views) || 0;
      igEng += interactionsOf(r);
    }
  }
  const totalViews = ttViews + igViews;
  const totalEng = ttEng + igEng;
  const kpi = {
    outletAktif: bundles.filter((b) => b.ttContent.length || b.igContent.length || b.history.length || b.snaps.length).length,
    totalViews,
    avgEr: totalViews > 0 ? Math.round((totalEng / totalViews) * 10000) / 100 : 0,
    totalFollower,
    platforms: { tiktok: ttViews > 0 || ttCount > 0, instagram: igViews > 0 || igCount > 0, threads: followerBars.some((o) => o.threads != null) },
  };

  // ---- Tren tayangan bulanan per platform (6 bulan terakhir, tak ikut filter bulan) ----
  const ttByMonth = new Map();
  const igByMonth = new Map();
  for (const b of bundles) {
    for (const r of b.ttContent) {
      const k = monthOf(r.post_date);
      if (!/^\d{4}-\d{2}$/.test(k || "")) continue;
      ttByMonth.set(k, (ttByMonth.get(k) || 0) + (Number(r.total_views) || 0));
    }
    for (const r of b.igContent) {
      const k = monthOf(String(r.published_at).slice(0, 10));
      if (!/^\d{4}-\d{2}$/.test(k || "")) continue;
      igByMonth.set(k, (igByMonth.get(k) || 0) + (Number(r.views) || 0));
    }
  }
  const trendMonths = [...new Set([...ttByMonth.keys(), ...igByMonth.keys()])].sort().slice(-6);
  const viewsTrend = {
    months: trendMonths,
    tiktok: trendMonths.map((m) => ({ x: m, y: ttByMonth.get(m) || 0 })),
    instagram: trendMonths.map((m) => ({ x: m, y: igByMonth.get(m) || 0 })),
  };

  // ---- Demografi rata-rata semua outlet (SUMBER: TikTok) ----
  const genderAcc = [];
  const terrAcc = new Map(); // code -> SUM pct
  let terrOutletCount = 0; // jumlah outlet yang punya snapshot wilayah (pembagi benar)
  for (const b of bundles) {
    const g = latestSnapshotRows(b.gender, "snapshot_date")[0];
    if (g && (g.male_pct != null || g.female_pct != null)) {
      genderAcc.push({ m: Number(g.male_pct) || 0, f: Number(g.female_pct) || 0, o: Number(g.other_pct) || 0 });
    }
    const trows = latestSnapshotRows(b.territories, "snapshot_date");
    if (trows.length) terrOutletCount += 1;
    for (const t of trows) {
      if (!t.territory_code) continue;
      terrAcc.set(t.territory_code, (terrAcc.get(t.territory_code) || 0) + (Number(t.distribution_pct) || 0));
    }
  }
  const avg = (arr) => (arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : 0);

  // Gender Instagram (rata-rata snapshot Pemirsa terbaru tiap outlet).
  const igGenderAcc = [];
  for (const b of bundles) {
    const a = latestSnapshotRows(b.igAudience, "snapshot_date")[0];
    if (a && (a.female_pct != null || a.male_pct != null)) {
      igGenderAcc.push({ f: Number(a.female_pct) || 0, m: Number(a.male_pct) || 0 });
    }
  }
  const igGender = igGenderAcc.length ? {
    outletsCounted: igGenderAcc.length,
    female: Math.round(avg(igGenderAcc.map((x) => x.f)) * 10) / 10,
    male: Math.round(avg(igGenderAcc.map((x) => x.m)) * 10) / 10,
  } : null;

  const demographics = (genderAcc.length || igGender) ? {
    tiktok: genderAcc.length ? {
      outletsCounted: genderAcc.length,
      male: Math.round(avg(genderAcc.map((x) => x.m)) * 10) / 10,
      female: Math.round(avg(genderAcc.map((x) => x.f)) * 10) / 10,
      other: Math.round(avg(genderAcc.map((x) => x.o)) * 10) / 10,
      territories: [...terrAcc.entries()]
        .map(([code, sum]) => ({ code, pct: Math.round((sum / Math.max(1, terrOutletCount)) * 10) / 10 }))
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 4),
    } : null,
    instagram: igGender,
  } : null;

  // ---- Top Pillars (join content_plans.primary_pillar ↔ konten tayang) ----
  // Tiap rencana yang punya link tayang & pillar dicocokkan ke konten aslinya untuk
  // mengambil views + ER, lalu diagregasi per pillar (rata-rata). Ikut filter bulan.
  const pillarAgg = new Map(); // pillar -> { views:[], er:[] }
  for (const b of bundles) {
    const igByShort = new Map();
    for (const c of b.igContent) { const sc = extractIgShortcode(c.permalink); if (sc) igByShort.set(sc, c); }
    const ttById = new Map();
    for (const c of b.ttContent) { const id = c.video_id || extractVideoId(c.video_link); if (id) ttById.set(String(id), c); }
    for (const p of b.plans) {
      const pillar = String(p.primary_pillar || "").trim();
      if (!pillar) continue;
      const pMonth = monthOf(String(p.plan_month || p.post_date || "").slice(0, 10));
      if (month && pMonth !== month) continue;
      // TikTok link
      const ttLink = String(p.posted_url || "").trim();
      const ttId = extractVideoId(ttLink);
      const ttMatch = ttId ? ttById.get(String(ttId)) : null;
      // IG link
      const igLink = p.platform_links && typeof p.platform_links === "object" ? String(p.platform_links.instagram || "").trim() : "";
      const igSc = extractIgShortcode(igLink);
      const igMatch = igSc ? igByShort.get(igSc) : null;
      const push = (views, er) => {
        if (views == null) return;
        if (!pillarAgg.has(pillar)) pillarAgg.set(pillar, { views: [], er: [] });
        const a = pillarAgg.get(pillar);
        a.views.push(views);
        if (er != null) a.er.push(er);
      };
      if (ttMatch) push(Number(ttMatch.total_views) || 0, ttEr(ttMatch));
      if (igMatch) push(Number(igMatch.views) || 0, erOf(igMatch));
    }
  }
  const topPillars = [...pillarAgg.entries()]
    .map(([pillar, a]) => ({
      pillar,
      count: a.views.length,
      avgViews: Math.round(avg(a.views)),
      avgEr: a.er.length ? Math.round(avg(a.er) * 100) / 100 : null,
    }))
    .sort((a, b) => b.avgViews - a.avgViews);

  // ---- Top Konten cross outlet & platform (scoped bulan) ----
  const pool = [];
  for (const b of bundles) {
    for (const r of b.ttContent) {
      if (!inMonth(r.post_date, month)) continue;
      pool.push({
        key: `tt-${b.acc.id}-${r.video_id}`,
        platform: "tiktok",
        outlet: b.acc.nama_cabang,
        title: (r.video_title || "").split("\n")[0] || "(tanpa judul)",
        link: r.video_link || null,
        views: Number(r.total_views) || 0,
        er: ttEr(r),
      });
    }
    for (const r of b.igContent) {
      if (!inMonth(String(r.published_at).slice(0, 10), month)) continue;
      pool.push({
        key: `ig-${b.acc.id}-${r.post_id}`,
        platform: "instagram",
        outlet: b.acc.nama_cabang,
        title: (r.description || "").split("\n")[0] || "(tanpa caption)",
        link: r.permalink || null,
        views: Number(r.views) || 0,
        er: erOf(r),
      });
    }
  }
  const byViews = [...pool].sort((a, b) => b.views - a.views).slice(0, 5);
  const byEr = pool
    .filter((c) => c.er != null && c.views >= (ER_MIN_VIEWS[c.platform] ?? 500))
    .sort((a, b) => b.er - a.er)
    .slice(0, 5);
  const topKonten = { byViews, byEr, hasEr: byEr.length > 0 };

  return {
    month,
    cat: effCat,
    categories,
    outletCount: outlets.length,
    kpi,
    followerBars: followerBars.slice(0, 6),
    viewsTrend,
    demographics,
    topPillars,
    topKonten,
  };
}
