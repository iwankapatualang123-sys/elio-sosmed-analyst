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

const monthOf = (d) => (typeof d === "string" ? d.slice(0, 7) : null);
const inMonth = (d, month) => !month || monthOf(d) === month;
// ER minimal butuh tayangan cukup supaya ranking ER tidak didominasi konten
// bertayangan sangat kecil (pembagi kecil → ER melambung menyesatkan).
const ER_MIN_VIEWS = 300;

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
  const outlets = cat ? all.filter((a) => a.kategori === cat) : all;

  // Ambil data tiap outlet secara PARALEL. Tiap outlet mengembalikan "bundle"
  // mentah + turunan yang dipakai agregasi lintas outlet di bawah.
  const bundles = await Promise.all(outlets.map(async (acc) => {
    const [{ data: ttc }, { data: igc }, { data: hist }, { data: snaps }, { data: igDaily }, { data: gender }, { data: terr }, { data: plans }] = await Promise.all([
      supabase.from("tiktok_content").select("video_id, video_title, video_link, post_date, total_views, total_likes, total_comments, total_shares").eq("tiktok_account_id", acc.id),
      supabase.from("instagram_content").select("post_id, description, permalink, post_type, published_at, views, likes, comments, shares, saves, is_collab").eq("tiktok_account_id", acc.id),
      supabase.from("tiktok_follower_history").select("date, followers").eq("tiktok_account_id", acc.id).order("date"),
      supabase.from("social_account_snapshots").select("platform, snapshot_date, followers").eq("tiktok_account_id", acc.id),
      supabase.from("instagram_daily_metrics").select("metric, date, value").eq("tiktok_account_id", acc.id),
      supabase.from("tiktok_follower_gender").select("snapshot_date, male_pct, female_pct, other_pct").eq("tiktok_account_id", acc.id),
      supabase.from("tiktok_follower_territories").select("snapshot_date, territory_code, distribution_pct").eq("tiktok_account_id", acc.id),
      supabase.from("content_plans").select("primary_pillar, posted_url, platform_links, plan_month, post_date").eq("tiktok_account_id", acc.id),
    ]);
    return {
      acc,
      ttContent: ttc || [],
      igContent: (igc || []).filter((r) => !r.is_collab),
      igDaily: igDaily || [],
      history: hist || [],
      snaps: snaps || [],
      gender: gender || [],
      territories: terr || [],
      plans: plans || [],
    };
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
  const terrAcc = new Map(); // code -> [pct,...]
  for (const b of bundles) {
    const g = latestSnapshotRows(b.gender, "snapshot_date")[0];
    if (g && (g.male_pct != null || g.female_pct != null)) {
      genderAcc.push({ m: Number(g.male_pct) || 0, f: Number(g.female_pct) || 0, o: Number(g.other_pct) || 0 });
    }
    for (const t of latestSnapshotRows(b.territories, "snapshot_date")) {
      if (!t.territory_code) continue;
      if (!terrAcc.has(t.territory_code)) terrAcc.set(t.territory_code, []);
      terrAcc.get(t.territory_code).push(Number(t.distribution_pct) || 0);
    }
  }
  const avg = (arr) => (arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : 0);
  const demographics = genderAcc.length ? {
    outletsCounted: genderAcc.length,
    male: Math.round(avg(genderAcc.map((x) => x.m)) * 10) / 10,
    female: Math.round(avg(genderAcc.map((x) => x.f)) * 10) / 10,
    other: Math.round(avg(genderAcc.map((x) => x.o)) * 10) / 10,
    territories: [...terrAcc.entries()]
      .map(([code, arr]) => ({ code, pct: Math.round(avg(arr) * 10) / 10 }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 4),
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
    .filter((c) => c.er != null && c.views >= ER_MIN_VIEWS)
    .sort((a, b) => b.er - a.er)
    .slice(0, 5);
  const topKonten = { byViews, byEr, hasEr: byEr.length > 0 };

  return {
    month,
    cat,
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
