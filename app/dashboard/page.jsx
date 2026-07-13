// File: app/dashboard/page.jsx
// Dashboard analitik TikTok (terproteksi). Server Component: muat metrik lintas
// cabang (KPI + ranking) dan detail 1 cabang (grafik). Blueprint bagian 4.

import { getCurrentProfile, canWrite } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadPortfolio, loadPortfolioInstagram, loadBranchDetail } from "@/lib/tiktok/analytics";
import Link from "next/link";
import Nav from "@/components/Nav";
import MonthFilter from "@/components/MonthFilter";
import { LineChart, Donut, BarChartLabeled, Heatmap } from "@/components/Charts";
import InsightAI from "@/components/InsightAI";
import OnboardingTips from "@/components/OnboardingTips";
import ProgressBar from "@/components/ProgressBar";
import { forecastNext } from "@/lib/tiktok/forecast";
import { matchPlanStatusMulti, summarizePlans } from "@/lib/tiktok/content-plan";
import { groupByPlatform, followerTrend, latestSnapshot, daysSince } from "@/lib/social/snapshots";
import { sumDaily, dailySeries, contentInPeriod, contentSummary, topContents, cumulativeFollowerSeries, contentTypeBreakdown, hashtagStats as igHashtagStats } from "@/lib/instagram/metrics";
import PlatformTabs from "@/components/PlatformTabs";
import PortfolioSummary from "@/components/PortfolioSummary";
import { addAnnotation, deleteAnnotation } from "./actions";

const BULAN_NAMA = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
function labelBulan(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  return `${BULAN_NAMA[Number(m) - 1] || m} ${y}`;
}
// Tanggal singkat "3 Jul" untuk label rentang aktivitas follower (jendela 7 hari).
function tglSingkat(d) {
  if (!d || !/^\d{4}-\d{2}-\d{2}/.test(d)) return "";
  const [, m, day] = d.slice(0, 10).split("-");
  return `${Number(day)} ${["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][Number(m) - 1]}`;
}
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
// Bangun URL /dashboard dgn param yang masih relevan saja (kosong -> dibuang).
function dashboardHref({ branch, cat, month } = {}) {
  const params = new URLSearchParams();
  if (branch) params.set("branch", branch);
  if (cat) params.set("cat", cat);
  if (month) params.set("month", month);
  const qs = params.toString();
  return qs ? `/dashboard?${qs}` : "/dashboard";
}

const INSIGHT_STYLE = {
  naik: { background: "#dcfce7", color: "#166534" },
  turun: { background: "#fee2e2", color: "#991b1b" },
  stabil: { background: "#fef9c3", color: "#854d0e" },
  info: { background: "#e0f2fe", color: "#075985" },
};

const ALERT_STYLE = {
  danger: { bg: "#fef2f2", border: "#fecaca", color: "#991b1b", icon: "🔴" },
  warning: { bg: "#fffbeb", border: "#fde68a", color: "#854d0e", icon: "🟠" },
  info: { bg: "#eff6ff", border: "#bfdbfe", color: "#075985", icon: "🔵" },
  success: { bg: "#f0fdf4", border: "#bbf7d0", color: "#166534", icon: "🟢" },
};

const fmt = (n) => Number(n || 0).toLocaleString("id-ID");

// Rekomendasi jam upload = ~30 menit sebelum jam puncak (agar video sudah tayang
// & masuk "golden hour" saat follower ramai). Puncak HH:00 -> (HH-1):30.
const uploadHint = (hour) => `${String((Number(hour) + 23) % 24).padStart(2, "0")}:30`;


// Warna badge 5 status Rencana Konten (samakan dgn ContentPlanBoard).
const PLAN_BADGE = {
  "On Going": { bg: "rgba(3,105,161,.1)", fg: "#0369a1" },
  Uploaded: { bg: "rgba(124,58,237,.1)", fg: "#7c3aed" },
  Verified: { bg: "rgba(22,101,52,.1)", fg: "#166534" },
  Cancelled: { bg: "rgba(180,83,9,.1)", fg: "#b45309" },
  Replaced: { bg: "rgba(161,98,7,.1)", fg: "#a16207" },
};

// Kartu follower dari snapshot manual (IG/Threads yang belum punya data upload).
// Dipakai di tab Ringkasan Platform. rows = deret snapshot 1 platform.
function SnapshotFollowerCard({ rows = [], todayStr }) {
  const { latest, delta } = followerTrend(rows);
  const last = latestSnapshot(rows);
  const age = daysSince(last?.snapshot_date, todayStr);
  const stale = age != null && age > 7;
  return (
    <div className="rounded-xl p-4" style={{ border: "1px solid rgba(0,60,68,.1)" }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>Follower (input manual)</span>
        <span className="text-[11px] font-medium" style={{ color: stale ? "#b45309" : "var(--ink-soft)" }} title={stale ? "Sudah lewat seminggu — perbarui di halaman Upload" : "Tanggal snapshot terakhir"}>
          {stale ? `⚠ terakhir ${age} hari lalu` : last?.snapshot_date}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-2xl font-extrabold" style={{ color: "var(--teal-900)" }}>{latest ? fmt(latest.followers) : "—"}</span>
        <span className="text-xs" style={{ color: "var(--ink-soft)" }}>followers</span>
        {delta != null && (
          <span className="text-xs font-semibold" style={{ color: delta > 0 ? "#166534" : delta < 0 ? "#b91c1c" : "var(--ink-soft)" }}>
            {delta > 0 ? `▲ +${fmt(delta)}` : delta < 0 ? `▼ ${fmt(delta)}` : "＝ 0"} vs sebelumnya
          </span>
        )}
      </div>
      {(last?.reach_30d != null || last?.profile_visits != null) && (
        <p className="mt-1 text-[11px]" style={{ color: "var(--ink-soft)" }}>
          {last?.reach_30d != null && <>Reach 30 hari: <b className="text-ink">{fmt(last.reach_30d)}</b></>}
          {last?.reach_30d != null && last?.profile_visits != null && " · "}
          {last?.profile_visits != null && <>Kunjungan profil: <b className="text-ink">{fmt(last.profile_visits)}</b></>}
        </p>
      )}
    </div>
  );
}

// Blok "Pencapaian Target BULANAN" untuk 1 platform (di tab Ringkasan Platform).
// Target diatur di Pengaturan (angka per bulan). Progress = capaian bulan yang
// ditinjau (monthLabel) vs target. Tampil hanya bila minimal 1 target dipasang.
function GoalProgress({ goal, views, er, net, monthLabel }) {
  if (!goal || (goal.target_total_views == null && goal.target_engagement_rate == null && goal.target_net_followers == null)) return null;
  return (
    <div className="mt-3 border-t pt-3" style={{ borderColor: "rgba(0,60,68,.1)" }}>
      <p className="mb-2 text-[11px] font-semibold" style={{ color: "var(--ink-soft)" }}>🎯 Pencapaian Target — {monthLabel}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {goal.target_total_views != null && <ProgressBar label="Total Views" current={views} target={goal.target_total_views} />}
        {goal.target_engagement_rate != null && <ProgressBar label="Engagement Rate" current={er} target={goal.target_engagement_rate} suffix="%" />}
        {goal.target_net_followers != null && <ProgressBar label="Net Follower" current={net} target={goal.target_net_followers} />}
      </div>
    </div>
  );
}

export default async function DashboardPage({ searchParams }) {
  const profile = await getCurrentProfile();
  if (!profile?.role) {
    return (
      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-6">
        <Nav email={profile?.email} role={profile?.role} />
        <section className="card-3d p-6">
          <h2 className="mb-2 text-base font-semibold text-ink">Akun belum diaktifkan</h2>
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            Hubungi admin untuk mengaktifkan akses cabang.
          </p>
        </section>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const sp = (await searchParams) || {};
  // Filter BULAN (blueprint 21A — evaluasi kinerja tim per bulan). Kosong/"all" =
  // sepanjang masa (perilaku asli). Target & Progress + Peringatan SENGAJA tetap
  // all-time walau bulan dipilih (lihat lib/tiktok/analytics.js).
  const selectedMonth = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : null;
  const { branches, portfolio, months } = await loadPortfolio(supabase, { month: selectedMonth });
  const igPortfolioData = await loadPortfolioInstagram(supabase, { month: selectedMonth });
  const selectedId = sp.branch || branches[0]?.id || null;
  const catFilter = sp.cat || null;
  const categories = [...new Set(branches.map((b) => b.kategori).filter(Boolean))];
  const rankedBranches = catFilter ? branches.filter((b) => b.kategori === catFilter) : branches;
  const rankedBranchesIg = catFilter ? igPortfolioData.branches.filter((b) => b.kategori === catFilter) : igPortfolioData.branches;
  const detail = await loadBranchDetail(supabase, selectedId, { month: selectedMonth });
  const selectedBranch = branches.find((b) => b.id === selectedId);
  // Target per (platform, bulan) — dikelola di Pengaturan. Pemilihan baris sesuai
  // bulan progres (progMonth) dilakukan di bawah, setelah progMonth ditentukan.
  const { data: goalsRaw } = selectedId
    ? await supabase.from("tiktok_account_goals").select("*").eq("tiktok_account_id", selectedId)
    : { data: [] };
  const { data: annotationsRaw } = selectedId
    ? await supabase.from("branch_annotations").select("*").eq("tiktok_account_id", selectedId).order("note_date", { ascending: false }).limit(50)
    : { data: [] };
  // Kalau lagi meninjau 1 bulan spesifik, catatan ikut disaring ke bulan itu saja.
  const annotations = selectedMonth
    ? (annotationsRaw || []).filter((a) => a.note_date && a.note_date.slice(0, 7) === selectedMonth)
    : (annotationsRaw || []);
  const editable = canWrite(profile);

  // Rencana konten BULAN INI + status verifikasi (untuk ringkasan di dashboard).
  const nowMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  let planThisMonth = [];
  if (selectedId) {
    const [{ data: plansM }, { data: contentsM }] = await Promise.all([
      supabase.from("content_plans")
        .select("id, post_date, plan_month, pic, headline, primary_pillar, acc_to_posting, posted_url, status_override, replaced_by_id, platforms, platform_links")
        .eq("tiktok_account_id", selectedId).eq("plan_month", `${nowMonth}-01`)
        .order("post_date", { ascending: true, nullsFirst: false }),
      supabase.from("tiktok_content").select("video_id, video_title, video_link").eq("tiktok_account_id", selectedId),
    ]);
    planThisMonth = (plansM || []).map((p) => {
      const r = matchPlanStatusMulti(p, contentsM || [], { currentMonth: nowMonth });
      return { ...p, status: r.status, hint: r.hint };
    });
  }
  const planSummary = summarizePlans(planThisMonth.map((p) => p.status));

  // Snapshot manual Instagram/Threads cabang terpilih (Lapis 1 laporan non-TikTok):
  // follower terakhir + delta vs snapshot sebelumnya + pengingat bila basi >7 hari.
  let socialSnaps = [];
  let igDaily = [];
  let igContent = [];
  if (selectedId) {
    const [{ data: snapRows }, { data: igd }, { data: igc }] = await Promise.all([
      supabase
        .from("social_account_snapshots")
        .select("platform, snapshot_date, followers, reach_30d, profile_visits")
        .eq("tiktok_account_id", selectedId)
        .order("snapshot_date", { ascending: false })
        .limit(24),
      supabase
        .from("instagram_daily_metrics")
        .select("metric, date, value")
        .eq("tiktok_account_id", selectedId),
      supabase
        .from("instagram_content")
        .select("post_id, description, permalink, post_type, published_at, views, reach, likes, comments, shares, saves, follows, is_collab")
        .eq("tiktok_account_id", selectedId),
    ]);
    socialSnaps = snapRows || [];
    igDaily = igd || [];
    igContent = igc || [];
  }
  const snapsByPlatform = groupByPlatform(socialSnaps);
  const todayStr = new Date().toISOString().slice(0, 10);

  // Panel Instagram (Tahap B): agregat dari data upload Business Suite, mengikuti
  // filter bulan halaman (tanpa filter = sepanjang data yang di-upload).
  const hasIgData = igDaily.length > 0 || igContent.length > 0;
  const igMonth = selectedMonth || null;
  const igSum = sumDaily(igDaily, igMonth);
  const igPeriodContents = contentInPeriod(igContent, igMonth);
  const igCSummary = contentSummary(igPeriodContents);
  const igTopReels = topContents(igPeriodContents, { onlyReels: true, limit: 5 });
  // Detail Instagram (per aspek, sejajar detail TikTok): tren harian, performa per
  // jenis konten, top konten semua jenis, pendatang follower, hashtag.
  const igViewsSeries = dailySeries(igDaily, "views", igMonth);
  const igReachSeries = dailySeries(igDaily, "reach", igMonth);
  const igVisitsSeries = dailySeries(igDaily, "profile_visits", igMonth);
  const igTypeBreakdown = contentTypeBreakdown(igPeriodContents);
  const igTopFollows = topContents(igPeriodContents.filter((c) => (c.follows || 0) > 0), { by: "follows", limit: 5 });
  const igHashtags = igHashtagStats(igPeriodContents, { limit: 12 });
  const igFollowerAnchor = followerTrend(snapsByPlatform.get("instagram") || []); // total follower (snapshot manual)
  // Total IG SEPANJANG MASA (untuk pencapaian target IG — tak ikut filter bulan).
  // Pencapaian target BULANAN: bulan yang ditinjau = filter bulan, atau bulan
  // berjalan bila "Semua bulan". Nilai TikTok & IG di-scope ke bulan itu.
  const progMonth = selectedMonth || nowMonth;
  const progMonthLabel = labelBulan(progMonth);
  // Target platform untuk BULAN progres (null bila belum diset utk bulan itu).
  const goalTiktok = (goalsRaw || []).find((g) => g.platform === "tiktok" && g.target_month === progMonth) || null;
  const goalInstagram = (goalsRaw || []).find((g) => g.platform === "instagram" && g.target_month === progMonth) || null;
  const ttProg = selectedMonth
    ? { views: detail.summary.totalViews, er: detail.summary.engagementRateOverall, net: detail.growth.netGrowth }
    : { views: detail.thisMonth.summary.totalViews, er: detail.thisMonth.summary.engagementRateOverall, net: detail.thisMonth.growth.netGrowth };
  const igProgSum = sumDaily(igDaily, progMonth);
  const igProgSummary = contentSummary(contentInPeriod(igContent, progMonth));
  // Garis follower IG utk grafik pertumbuhan: TOTAL per tanggal dari delta harian
  // + jangkar snapshot manual, lalu discope ke bulan terpilih (spt garis TikTok).
  const igFollowerSeriesAll = cumulativeFollowerSeries(igDaily, igFollowerAnchor.latest);
  const igFollowerSeries = selectedMonth
    ? igFollowerSeriesAll.filter((p) => p.x.slice(0, 7) === selectedMonth)
    : igFollowerSeriesAll;
  // Garis grafik pakai PERTAMBAHAN follower per hari (bukan total) — skala kedua
  // platform jadi sebanding; total awal→akhir tetap tampil di ringkasan atas grafik.
  const igGrowthSeries = igDaily
    .filter((r) => r.metric === "new_followers" && (!selectedMonth || String(r.date).slice(0, 7) === selectedMonth))
    .map((r) => ({ x: String(r.date).slice(0, 10), y: r.value || 0 }))
    .sort((a, b) => a.x.localeCompare(b.x));
  // AGREGAT BULANAN utk tampilan "Semua bulan": titik harian akan bertumpuk terus
  // seiring bulan bertambah — jadi tanpa filter bulan, grafik memakai net growth
  // PER BULAN (bulan terlama → terbaru, otomatis ikut data laporan terbaru).
  // Pilih 1 bulan di filter untuk kembali melihat detail harian.
  const monthlySum = (points) => {
    const m = new Map();
    for (const p of points) {
      const k = String(p.x).slice(0, 7);
      m.set(k, (m.get(k) || 0) + (Number(p.y) || 0));
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([x, y]) => ({ x, y }));
  };
  const ttGrowthMonthly = monthlySum(detail.history.map((h) => ({ x: h.date, y: Number(h.diff_from_previous_day) || 0 })));
  const igGrowthMonthly = monthlySum(
    igDaily.filter((r) => r.metric === "new_followers").map((r) => ({ x: r.date, y: r.value || 0 }))
  );

  return (
    <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <Nav email={profile.email} role={profile.role} />

      {/* Hero judul */}
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-sm sm:text-3xl">
            Dashboard Analitik
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: "rgba(255,255,255,.75)" }}>
            {selectedMonth ? `Meninjau ${labelBulan(selectedMonth)} — untuk evaluasi kinerja tim` : "Ringkasan performa TikTok lintas cabang (sepanjang masa)"}
          </p>
        </div>
        <MonthFilter months={months} />
      </div>

      {selectedMonth && (
        <div className="rounded-xl px-4 py-2.5 text-sm" style={{ background: "rgba(240,180,90,.15)", color: "#8a5a12" }}>
          📅 Semua angka di halaman ini (KPI, ranking, grafik, insight AI) dihitung khusus untuk <b>{labelBulan(selectedMonth)}</b>, kecuali <b>Target &amp; Progress</b> dan <b>Peringatan</b> yang tetap sepanjang masa (target itu tujuan berjalan, bukan target per bulan). Proyeksi follower disembunyikan saat meninjau bulan lampau.
        </div>
      )}

      <OnboardingTips />

      {/* KPI portofolio + Ranking Cabang dgn toggle platform TikTok/Instagram. */}
      <PortfolioSummary
        tiktok={{ portfolio, ranked: rankedBranches }}
        instagram={{ portfolio: igPortfolioData.portfolio, ranked: rankedBranchesIg }}
        categories={categories}
        catFilter={catFilter}
        selectedMonth={selectedMonth}
        monthLabel={selectedMonth ? labelBulan(selectedMonth) : ""}
      />

      {/* Detail 1 cabang */}
      {detail && selectedBranch && (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white drop-shadow">
              <span style={{ width: 6, height: 22, borderRadius: 3, background: "linear-gradient(180deg,#7fe0d0,#0a8291)", display: "inline-block" }} />
              Detail: {selectedBranch.nama_cabang}
            </h2>
            <Link
              href={selectedMonth ? `/report/${selectedId}?month=${selectedMonth}` : `/report/${selectedId}`}
              className="rounded-full bg-white px-3 py-1 text-xs font-semibold"
              style={{ color: "var(--teal-900)" }}
            >
              📄 Laporan
            </Link>
            {branches.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {branches.map((b) => (
                  <Link
                    key={b.id}
                    href={dashboardHref({ branch: b.id, cat: catFilter, month: selectedMonth })}
                    className="rounded-full px-3 py-1 text-xs font-medium"
                    style={b.id === selectedId
                      ? { background: "#fff", color: "var(--teal-900)" }
                      : { background: "rgba(255,255,255,.2)", color: "#fff" }}
                  >
                    {b.nama_cabang}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Rencana Konten bulan ini + status verifikasi */}
          <section className="card-3d p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-ink">🗂️ Rencana Konten Bulan Ini</h3>
              {[["Verified", planSummary.verified], ["Uploaded", planSummary.uploaded], ["On Going", planSummary.onGoing], ["Cancelled", planSummary.cancelled], ["Replaced", planSummary.replaced]]
                .filter(([, n]) => n > 0)
                .map(([label, n]) => {
                  const c = PLAN_BADGE[label];
                  return <span key={label} className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: c.bg, color: c.fg }}>{n} {label}</span>;
                })}
              <Link href={`/content-plan?branch=${selectedId}&month=${nowMonth}`} className="ml-auto rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "rgba(0,102,116,.1)", color: "var(--teal-900)" }}>
                Kelola →
              </Link>
            </div>
            {planThisMonth.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                Belum ada rencana konten bulan ini. <Link href={`/content-plan?branch=${selectedId}&month=${nowMonth}`} style={{ color: "var(--teal-900)", fontWeight: 600 }}>Buat rencana →</Link>
              </p>
            ) : (
              <div className="overflow-auto" style={{ maxHeight: 300 }}>
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0" style={{ background: "#eaf5ec" }}>
                    <tr style={{ color: "var(--ink-soft)" }}>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 pr-3 font-medium">Post</th>
                      <th className="py-2 pr-3 font-medium">Headline / Hook</th>
                      <th className="py-2 pr-3 font-medium">PIC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planThisMonth.map((p) => {
                      const c = PLAN_BADGE[p.status] || PLAN_BADGE["On Going"];
                      return (
                        <tr key={p.id} className="border-t align-top" style={{ borderColor: "rgba(0,60,68,.08)", opacity: p.status === "Replaced" || p.status === "Cancelled" ? 0.6 : 1 }}>
                          <td className="py-2 pr-3">
                            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: c.bg, color: c.fg }}>
                              {p.status || "On Going"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap py-2 pr-3" style={{ color: "var(--ink-soft)" }}>{p.post_date ? p.post_date.slice(0, 10) : "—"}</td>
                          <td className="py-2 pr-3 text-ink"><span className="line-clamp-1 max-w-xs">{p.headline || "—"}</span></td>
                          <td className="whitespace-nowrap py-2 pr-3" style={{ color: "var(--ink-soft)" }}>{p.pic || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Ringkasan Platform — tab TikTok/Instagram dgn gaya kartu yang sama
              supaya gampang dibandingkan; keduanya ikut filter bulan halaman. */}
          <section className="card-3d p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-ink">📱 Ringkasan Platform</h3>
              <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "rgba(0,102,116,.08)", color: "var(--teal-900)" }}>
                {igMonth ? labelBulan(igMonth) : selectedMonth ? labelBulan(selectedMonth) : "Sepanjang masa"}
              </span>
              {editable && (
                <Link href="/upload" className="ml-auto rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "rgba(0,102,116,.1)", color: "var(--teal-900)" }}>
                  Upload data →
                </Link>
              )}
            </div>
            <PlatformTabs tabs={["TikTok", "Instagram", "Threads"]}>
              {/* Tab TikTok — format sama dgn tab Instagram: 5 kotak KPI (diakhiri
                  ER), ringkasan, lalu Top 5 Video. Rincian lengkap (grafik, heatmap,
                  gender, insight) tetap di bagian "Detail TikTok" di bawah. */}
              <div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
                  {[
                    ["Views", fmt(detail.summary.totalViews)],
                    ["Konten", fmt(detail.summary.totalVideos)],
                    ["Follower Δ", `${detail.growth.netGrowth >= 0 ? "+" : ""}${fmt(detail.growth.netGrowth)}`],
                    ["Rata-rata views/konten", fmt(detail.summary.avgViewsPerPost)],
                    ["ER akun", `${detail.summary.engagementRateOverall}%`],
                  ].map(([label, val]) => (
                    <div key={label} className="rounded-xl p-3" style={{ border: "1px solid rgba(0,60,68,.1)" }}>
                      <div className="text-lg font-extrabold sm:text-xl" style={{ color: "var(--teal-900)" }}>{val}</div>
                      <div className="mt-0.5 text-[11px] font-medium" style={{ color: "var(--ink-soft)" }}>{label}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px]" style={{ color: "var(--ink-soft)" }}>
                  Dari data report TikTok Studio{selectedMonth ? ` — ${labelBulan(selectedMonth)}` : " (sepanjang masa)"}. Grafik, heatmap, gender, & insight lengkap ada di bagian <b>Detail TikTok</b> di bawah.
                </p>
                {detail.summary.totalVideos > 0 && (
                  <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
                    <b className="text-ink">{fmt(detail.summary.totalVideos)}</b> konten · ER akun{" "}
                    <b className="text-ink">{detail.summary.engagementRateOverall}%</b> · Follower{" "}
                    <b style={{ color: detail.growth.netGrowth > 0 ? "#166534" : detail.growth.netGrowth < 0 ? "#b91c1c" : "inherit" }}>
                      {detail.growth.netGrowth >= 0 ? "+" : ""}{fmt(detail.growth.netGrowth)}
                    </b>
                  </p>
                )}
                {detail.topVideos.length > 0 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr style={{ color: "var(--ink-soft)" }}>
                          <th className="py-1.5 pr-2 font-medium">#</th>
                          <th className="py-1.5 pr-3 font-medium">Top Video</th>
                          <th className="py-1.5 pr-3 font-medium">Views</th>
                          <th className="py-1.5 pr-3 font-medium">ER</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.topVideos.map((v, i) => (
                          <tr key={v.video_id || i} className="border-t align-top" style={{ borderColor: "rgba(0,60,68,.08)" }}>
                            <td className="py-1.5 pr-2 text-[12px]" style={{ color: "var(--ink-soft)" }}>{i + 1}</td>
                            <td className="max-w-xs py-1.5 pr-3">
                              {v.video_link ? (
                                <a href={v.video_link} target="_blank" rel="noopener noreferrer" className="line-clamp-1 font-medium text-ink hover:underline" title={v.video_title || ""}>
                                  {v.video_title || "(tanpa judul)"}
                                </a>
                              ) : (
                                <span className="line-clamp-1 font-medium text-ink">{v.video_title || "(tanpa judul)"}</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap py-1.5 pr-3 font-semibold text-ink">{fmt(v.total_views)}</td>
                            <td className="whitespace-nowrap py-1.5 pr-3">{v.engagement_rate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <GoalProgress
                  goal={goalTiktok}
                  views={ttProg.views}
                  er={ttProg.er}
                  net={ttProg.net}
                  monthLabel={progMonthLabel}
                />
              </div>

              {/* Tab Instagram — data upload Business Suite; fallback ke snapshot
                  manual (followers) kalau belum pernah upload. */}
              <div>
              {!hasIgData ? (
                (snapsByPlatform.get("instagram") || []).length > 0 ? (
                  <>
                    <SnapshotFollowerCard rows={snapsByPlatform.get("instagram")} todayStr={todayStr} />
                    <p className="mt-2 text-[11px]" style={{ color: "var(--ink-soft)" }}>
                      Baru dari input manual mingguan. Untuk detail lengkap (tayangan, Reels, ER), upload export Meta Business Suite di halaman{" "}
                      <Link href="/upload" style={{ color: "var(--teal-900)", fontWeight: 600 }}>Upload</Link>.
                    </p>
                  </>
                ) : (
                  <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                    Belum ada data Instagram untuk cabang ini. Upload export Meta Business Suite (atau catat followers manual) lewat halaman{" "}
                    <Link href="/upload" style={{ color: "var(--teal-900)", fontWeight: 600 }}>Upload</Link>.
                  </p>
                )
              ) : (
              <>
              {/* KPI akun dari metrik harian + ER akun (5 kotak, sejajar tab TikTok) */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
                {[
                  ["Tayangan", igSum.views],
                  ["Jangkauan", igSum.reach],
                  ["Kunjungan profil", igSum.profile_visits],
                  ["Follower baru", igSum.new_followers == null ? null : `+${fmt(igSum.new_followers)}`],
                  ["ER akun", igCSummary.er == null ? null : `${igCSummary.er}%`],
                ].map(([label, val]) => (
                  <div key={label} className="rounded-xl p-3" style={{ border: "1px solid rgba(0,60,68,.1)" }}>
                    <div className="text-lg font-extrabold sm:text-xl" style={{ color: "var(--teal-900)" }}>
                      {val == null ? "—" : typeof val === "string" ? val : fmt(val)}
                    </div>
                    <div className="mt-0.5 text-[11px] font-medium" style={{ color: "var(--ink-soft)" }}>{label}</div>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-[11px]" style={{ color: "var(--ink-soft)" }}>
                Dari data harian ({igSum.days} hari terekam{igMonth ? ` di ${labelBulan(igMonth)}` : ""}). Angka tayangan mencakup semua jenis konten termasuk Story.
                {igFollowerAnchor.latest && (
                  <> Total follower: <b className="text-ink">{fmt(igFollowerAnchor.latest.followers)}</b> (snapshot {igFollowerAnchor.latest.snapshot_date}).</>
                )}
              </p>

              {/* Ringkasan konten + ER akun */}
              {igCSummary.count > 0 && (
                <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
                  <b className="text-ink">{igCSummary.count}</b> konten ({igCSummary.reels} Reels) · ER akun{" "}
                  <b className="text-ink">{igCSummary.er == null ? "—" : `${igCSummary.er}%`}</b> · <b className="text-ink">+{fmt(igCSummary.follows)}</b> follower datang dari konten
                </p>
              )}

              {/* Top 5 Reels periode terpilih */}
              {igTopReels.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr style={{ color: "var(--ink-soft)" }}>
                        <th className="py-1.5 pr-2 font-medium">#</th>
                        <th className="py-1.5 pr-3 font-medium">Top Reels</th>
                        <th className="py-1.5 pr-3 font-medium">Tayang</th>
                        <th className="py-1.5 pr-3 font-medium">Views</th>
                        <th className="py-1.5 pr-3 font-medium">ER</th>
                        <th className="py-1.5 pr-3 font-medium">+Follower</th>
                      </tr>
                    </thead>
                    <tbody>
                      {igTopReels.map((c, i) => (
                        <tr key={c.post_id} className="border-t align-top" style={{ borderColor: "rgba(0,60,68,.08)" }}>
                          <td className="py-1.5 pr-2 text-[12px]" style={{ color: "var(--ink-soft)" }}>{i + 1}</td>
                          <td className="max-w-xs py-1.5 pr-3">
                            <a href={c.permalink || "#"} target="_blank" rel="noopener noreferrer" className="line-clamp-1 font-medium text-ink hover:underline" title={c.description || ""}>
                              {(c.description || "(tanpa caption)").split("\n")[0]}
                            </a>
                          </td>
                          <td className="whitespace-nowrap py-1.5 pr-3 text-[12px]" style={{ color: "var(--ink-soft)" }}>{String(c.published_at || "").slice(0, 10) || "—"}</td>
                          <td className="whitespace-nowrap py-1.5 pr-3 font-semibold text-ink">{fmt(c.views)}</td>
                          <td className="whitespace-nowrap py-1.5 pr-3">{c.er == null ? "—" : `${c.er}%`}</td>
                          <td className="whitespace-nowrap py-1.5 pr-3" style={{ color: "#166534" }}>{c.follows == null ? "—" : `+${fmt(c.follows)}`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <GoalProgress
                goal={goalInstagram}
                views={igProgSum.views || 0}
                er={igProgSummary.er || 0}
                net={igProgSum.new_followers || 0}
                monthLabel={progMonthLabel}
              />
              </>
              )}
              </div>

              {/* Tab Threads — input manual (Threads tidak punya export report). */}
              <div>
                {(snapsByPlatform.get("threads") || []).length > 0 ? (
                  <>
                    <SnapshotFollowerCard rows={snapsByPlatform.get("threads")} todayStr={todayStr} />
                    <p className="mt-2 text-[11px]" style={{ color: "var(--ink-soft)" }}>
                      Threads belum menyediakan export data, jadi hanya followers yang dicatat manual. Perbarui <b>seminggu sekali</b> di halaman{" "}
                      <Link href="/upload" style={{ color: "var(--teal-900)", fontWeight: 600 }}>Upload</Link>.
                    </p>
                  </>
                ) : (
                  <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                    Belum ada data Threads. Catat followers Threads cabang ini <b>seminggu sekali</b> lewat halaman{" "}
                    <Link href="/upload" style={{ color: "var(--teal-900)", fontWeight: 600 }}>Upload</Link> untuk melihat perkembangannya di sini.
                  </p>
                )}
              </div>
            </PlatformTabs>
          </section>

          {/* Pertumbuhan Follower + Info ringkas — tepat di bawah Ringkasan Platform.
              Grafik 2 garis (TikTok+IG) + strip info (views/ER/follower/audiens/
              retensi) supaya tidak tersebar jadi banyak kartu bulky. */}
          <section className="card-3d p-4 sm:p-5">
            <h3 className="mb-1 text-sm font-semibold text-ink">📈 Pertumbuhan Follower{selectedMonth ? ` — ${labelBulan(selectedMonth)}` : ""}</h3>
            {!selectedMonth && detail.history.length >= 2 ? (() => {
              const fc = forecastNext(detail.history.map((h) => h.followers), 7);
              return (
                <p className="mb-2 text-xs" style={{ color: "var(--ink-soft)" }}>
                  Proyeksi follower TikTok 7 hari: <b style={{ color: fc.trend === "naik" ? "#166534" : fc.trend === "turun" ? "#991b1b" : "inherit" }}>~{fmt(fc.nextValue)} ({fc.trend})</b>
                </p>
              );
            })() : <div className="mb-2" />}
            <div className="mb-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: "var(--ink-soft)" }}>
              <span>
                <b style={{ color: "#006674" }}>TikTok</b> {fmt(detail.growth.startFollowers)} → <b className="text-ink">{fmt(detail.growth.endFollowers)}</b>{" "}
                <b style={{ color: detail.growth.netGrowth > 0 ? "#166534" : detail.growth.netGrowth < 0 ? "#b91c1c" : "inherit" }}>
                  ({detail.growth.netGrowth >= 0 ? "+" : ""}{fmt(detail.growth.netGrowth)})
                </b>
              </span>
              {igFollowerSeries.length >= 2 && (
                <span>
                  <b style={{ color: "#c13584" }}>Instagram</b> {fmt(igFollowerSeries[0].y)} → <b className="text-ink">{fmt(igFollowerSeries[igFollowerSeries.length - 1].y)}</b>{" "}
                  <b style={{ color: "#166534" }}>(+{fmt(igFollowerSeries[igFollowerSeries.length - 1].y - igFollowerSeries[0].y)})</b>
                </span>
              )}
            </div>
            {selectedMonth || (ttGrowthMonthly.length < 2 && igGrowthMonthly.length < 2) ? (
              <>
                <LineChart
                  series={[
                    { label: "TikTok", color: "#006674", data: detail.history.map((h) => ({ x: h.date, y: Number(h.diff_from_previous_day) || 0 })) },
                    ...(igGrowthSeries.length >= 2 ? [{ label: "Instagram", color: "#c13584", data: igGrowthSeries }] : []),
                  ]}
                />
                <p className="mt-1 text-[10px]" style={{ color: "var(--ink-soft)" }}>
                  Garis = pertambahan follower per hari (bisa minus saat ada unfollow). Total ada di ringkasan atas.
                </p>
              </>
            ) : (
              <>
                <LineChart
                  series={[
                    { label: "TikTok", color: "#006674", data: ttGrowthMonthly },
                    ...(igGrowthMonthly.length >= 2 ? [{ label: "Instagram", color: "#c13584", data: igGrowthMonthly }] : []),
                  ]}
                />
                <p className="mt-1 text-[10px]" style={{ color: "var(--ink-soft)" }}>
                  Garis = pertambahan follower <b>per bulan</b> (bulan terlama s/d terbaru; bulan berjalan s/d data terakhir). Pilih satu bulan di filter atas untuk detail harian.
                </p>
              </>
            )}

          </section>

          {/* Analisis Pertumbuhan — SATU kartu di bawah grafik: (a) diagnosis sebab
              perlambatan (muncul otomatis saat follower melambat) + (b) Insight per
              aspek (Konten/ER/Follower/Retensi) yang selalu tampil. Digabung supaya
              tidak jadi dua blok terpisah. */}
          {(detail.growthDiagnosis || (detail.insights || []).length > 0) && (
            <section className="card-3d p-4 sm:p-5">
              <h3 className="mb-3 text-sm font-semibold text-ink">
                🔍 Analisis Pertumbuhan{detail.growthDiagnosis ? ` — ${labelBulan(detail.growthDiagnosis.curMonth)} vs ${labelBulan(detail.growthDiagnosis.prevMonth)}` : ""}
              </h3>

              {/* (a) Diagnosis perlambatan follower — hanya saat melambat */}
              {detail.growthDiagnosis && (() => {
                const dg = detail.growthDiagnosis;
                const s = ALERT_STYLE[dg.level] || ALERT_STYLE.info;
                const chip = {
                  turun: { bg: "#fee2e2", fg: "#991b1b" },
                  ada: { bg: "#fef3c7", fg: "#92400e" },
                  stabil: { bg: "#dcfce7", fg: "#166534" },
                  tidak: { bg: "rgba(0,102,116,.08)", fg: "var(--teal-900)" },
                };
                return (
                  <div className="mb-4 border-b pb-4" style={{ borderColor: "rgba(0,60,68,.1)" }}>
                    <p className="mb-3 text-xs" style={{ color: "var(--ink-soft)" }}>
                      Kenaikan follower melambat: <b className="text-ink">{dg.growth.prev >= 0 ? "+" : ""}{fmt(dg.growth.prev)}</b> →{" "}
                      <b className="text-ink">{dg.growth.cur >= 0 ? "+" : ""}{fmt(dg.growth.cur)}</b>. Follower itu <i>akibat</i> — di bawah ini pemeriksaan <i>sebab</i>-nya.
                    </p>
                    <div className="mb-3 flex items-start gap-2 rounded-xl p-3 text-sm" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                      <span>{s.icon}</span>
                      <span className="text-ink"><b style={{ color: s.color }}>Kesimpulan:</b> {dg.summary}</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {dg.findings.map((f) => {
                        const c = chip[f.status] || chip.tidak;
                        return (
                          <div key={f.key} className="rounded-xl p-3" style={{ border: "1px solid rgba(0,60,68,.1)" }}>
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-ink">{f.label}</span>
                              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: c.bg, color: c.fg }}>{f.status}</span>
                            </div>
                            <p className="text-[12px]" style={{ color: "var(--ink-soft)" }}>{f.detail}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* (b) Insight per aspek (Kesimpulan + Saran) — selalu tampil */}
              {(detail.insights || []).length > 0 && (
                <>
                  {detail.growthDiagnosis && (
                    <p className="mb-2 text-[11px] font-semibold" style={{ color: "var(--ink-soft)" }}>Insight per aspek</p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {detail.insights.map((ins, i) => (
                      <div key={i} className="rounded-xl p-4" style={{ border: "1px solid rgba(0,60,68,.1)" }}>
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-sm font-semibold text-ink">{ins.aspek}</span>
                          <span className="ml-auto rounded-full px-2 py-0.5 text-xs font-semibold" style={INSIGHT_STYLE[ins.status] || INSIGHT_STYLE.info}>
                            {ins.status}
                          </span>
                        </div>
                        <p className="text-sm text-ink">{ins.kesimpulan}</p>
                        <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>💡 {ins.saran}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {/* Target & Progress dipindah: pengaturan target ada di halaman Pengaturan
              (per cabang & platform), progress-nya tampil di tab Ringkasan Platform. */}

          {/* Anotasi / catatan tanggal (blueprint 21A) */}
          <section className="card-3d p-4 sm:p-5">
            <h3 className="mb-3 text-sm font-semibold text-ink">📌 Catatan / Anotasi</h3>
            <form action={addAnnotation} className="mb-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="accountId" value={selectedId} />
              <input type="date" name="note_date" required className="input-3d !min-h-0 !py-1.5 text-sm" />
              <input name="note" required placeholder="Catatan (mis. promo, kolaborasi influencer)" className="input-3d !min-h-0 !py-1.5 text-sm min-w-[200px] flex-1" />
              <button type="submit" className="btn btn-ghost !min-h-0 !py-1.5 text-sm">+ Tambah</button>
            </form>
            {(annotations || []).length === 0 ? (
              <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Belum ada catatan. Tambahkan konteks di tanggal penting (promo, kolaborasi) untuk menjelaskan lonjakan/penurunan.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {annotations.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 rounded-xl bg-white/60 px-3 py-1.5 text-sm">
                    <span className="rounded-md px-2 py-0.5 text-xs font-semibold" style={{ background: "rgba(0,102,116,.1)", color: "var(--teal-900)" }}>{a.note_date}</span>
                    <span className="min-w-0 flex-1 text-ink">{a.note}</span>
                    <span className="hidden text-xs sm:inline" style={{ color: "var(--ink-soft)" }}>{a.created_by_email}</span>
                    <form action={deleteAnnotation}>
                      <input type="hidden" name="id" value={a.id} />
                      <button type="submit" className="text-red-500 hover:text-red-700" aria-label="Hapus">✕</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Peringatan / alert (anomali + reminder upload) */}
          {detail.alerts && detail.alerts.length > 0 && (
            <section className="card-3d p-4 sm:p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
                🔔 Peringatan
                <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: "rgba(0,102,116,.1)", color: "var(--teal-900)" }}>
                  {detail.alerts.length}
                </span>
              </h3>
              <div className="flex flex-col gap-2">
                {detail.alerts.map((a, i) => {
                  const s = ALERT_STYLE[a.level] || ALERT_STYLE.info;
                  return (
                    <div key={i} className="flex items-start gap-2 rounded-xl p-3 text-sm" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                      <span>{s.icon}</span>
                      <span>
                        <b style={{ color: s.color }}>{a.title}.</b>{" "}
                        <span className="text-ink">{a.message}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <InsightAI accountId={selectedId} namaCabang={selectedBranch.nama_cabang} month={selectedMonth} />

          {/* ————— Detail per platform ————— */}
          <div className="mt-1 flex items-center gap-2 px-1">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-sm" style={{ background: "rgba(0,102,116,.12)" }}>🎵</span>
            <h2 className="text-lg font-bold text-white drop-shadow-sm">Detail TikTok</h2>
          </div>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="card-3d p-5">
              <h3 className="text-sm font-semibold text-ink">Jam Terbaik untuk Posting</h3>
              {detail.activityRange ? (
                <>
                  <p className="mb-2 text-xs" style={{ color: "var(--ink-soft)" }}>
                    5 jam dengan follower paling aktif — dari aktivitas <b>7 hari terakhir</b> ({tglSingkat(detail.activityRange.from)}–{tglSingkat(detail.activityRange.to)}). Data ini bukan per-bulan (TikTok cuma menyediakan 7 hari terakhir).
                  </p>
                  {detail.bestDayHour && (
                    <p className="mb-2 text-xs font-semibold" style={{ color: "var(--teal-900)" }}>
                      🏆 Hari &amp; jam paling ramai: <b>{HARI[detail.bestDayHour.weekday]} {String(detail.bestDayHour.hour).padStart(2, "0")}:00</b> (~{fmt(Math.round(detail.bestDayHour.value))} follower aktif)
                    </p>
                  )}
                  {detail.bestHours.topHours[0] && (
                    <p className="mb-3 rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(240,180,90,.15)", color: "#8a5a12" }}>
                      💡 Puncak jam <b>{String(detail.bestHours.topHours[0].hour).padStart(2, "0")}:00</b> — disarankan <b>upload ~{uploadHint(detail.bestHours.topHours[0].hour)}</b> (±30 menit sebelum puncak) supaya video sudah tayang & masuk &quot;golden hour&quot; saat follower ramai.
                    </p>
                  )}
                  <BarChartLabeled
                    data={detail.bestHours.topHours.map((h) => ({ label: `${String(h.hour).padStart(2, "0")}:00`, value: h.avgActive }))}
                    format={(v) => Math.round(v)}
                  />
                </>
              ) : (
                <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>Belum ada data aktivitas follower per jam. Muncul setelah upload file <b>FollowerActivity</b> dari TikTok Studio (mencakup 7 hari terakhir).</p>
              )}
            </div>

            <div className="card-3d p-5">
              <h3 className="mb-0.5 text-sm font-semibold text-ink">Gender Follower (TikTok)</h3>
              {detail.genderSnapshotDate && (
                <p className="mb-2 text-[11px]" style={{ color: "var(--ink-soft)" }}>Snapshot {detail.genderSnapshotDate}</p>
              )}
              {detail.gender ? (
                <Donut
                  data={[
                    { label: "Pria", value: Number(detail.gender.male_pct) || 0, color: "#2c5f9e" },
                    { label: "Wanita", value: Number(detail.gender.female_pct) || 0, color: "#c85a8a" },
                    { label: "Lainnya", value: Number(detail.gender.other_pct) || 0, color: "#93bcad" },
                  ]}
                />
              ) : (
                <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                  {selectedMonth ? `Belum ada snapshot gender pada/sebelum ${labelBulan(selectedMonth)}.` : "Belum ada data gender."}
                </p>
              )}
            </div>

            <div className="card-3d p-5">
              <h3 className="mb-3 text-sm font-semibold text-ink">Penonton: Baru vs Kembali</h3>
              <Donut
                center={`${detail.viewers.newPct}%`}
                data={[
                  { label: "Baru", value: detail.viewers.totalNew, color: "#4f9e7a" },
                  { label: "Kembali", value: detail.viewers.totalReturning, color: "#006674" },
                ]}
              />
            </div>
          </section>

          <section className="card-3d p-4 sm:p-5">
            <h3 className="mb-3 text-sm font-semibold text-ink"># Analisis Hashtag{selectedMonth ? ` — ${labelBulan(selectedMonth)}` : ""}</h3>
            {(detail.hashtags || []).length === 0 ? (
              <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Belum ada hashtag di judul video.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {detail.hashtags.map((h) => (
                  <span
                    key={h.hashtag}
                    title={`${h.count}x dipakai · avg ${fmt(h.avgViews)} views · ER ${h.avgEngagementRate}%`}
                    className="rounded-full px-3 py-1 font-medium"
                    style={{ background: "rgba(0,102,116,.08)", color: "var(--teal-900)", fontSize: `${12 + Math.min(8, h.count)}px` }}
                  >
                    {h.hashtag} <b>{h.count}</b>
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="card-3d p-5">
            <h3 className="mb-1 text-sm font-semibold text-ink">Heatmap Jam × Hari (follower aktif TikTok)</h3>
            {detail.activityRange ? (
              <>
                <p className="mb-3 text-xs" style={{ color: "var(--ink-soft)" }}>Dari aktivitas 7 hari terakhir ({tglSingkat(detail.activityRange.from)}–{tglSingkat(detail.activityRange.to)}) — bukan per-bulan.</p>
                <Heatmap heatmap={detail.bestHours.heatmap} />
              </>
            ) : (
              <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Belum ada data aktivitas follower per jam.</p>
            )}
          </section>

          {/* Top 5 Video TikTok dipindah ke Ringkasan Platform (tab TikTok) —
              tidak diduplikasi di sini. */}

          {/* ————— Detail Instagram (dari upload Business Suite) ————— */}
          {hasIgData && (
            <>
              <div className="mt-3 flex items-center gap-2 px-1">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-sm" style={{ background: "rgba(193,53,132,.14)" }}>📸</span>
                <h2 className="text-lg font-bold text-white drop-shadow-sm">Detail Instagram</h2>
                <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "rgba(255,255,255,.2)", color: "#fff" }}>
                  {igMonth ? labelBulan(igMonth) : "Sepanjang data"}
                </span>
              </div>

              {/* Tren harian: Tayangan, Jangkauan, Kunjungan profil */}
              <section className="grid gap-4 lg:grid-cols-3">
                {[
                  ["Tayangan / hari", igViewsSeries, "#c13584"],
                  ["Jangkauan / hari", igReachSeries, "#8a3ab9"],
                  ["Kunjungan profil / hari", igVisitsSeries, "#e1306c"],
                ].map(([title, ser, color]) => (
                  <div key={title} className="card-3d p-5">
                    <h3 className="mb-1 text-sm font-semibold text-ink">{title}</h3>
                    <p className="mb-2 text-[11px]" style={{ color: "var(--ink-soft)" }}>
                      Total {fmt(ser.reduce((s, p) => s + p.y, 0))} · {ser.length} hari
                    </p>
                    <LineChart data={ser.map((p) => ({ x: p.x, y: p.y }))} color={color} />
                  </div>
                ))}
              </section>

              {/* Performa per jenis konten + hashtag IG */}
              <section className="grid gap-4 lg:grid-cols-2">
                <div className="card-3d p-4 sm:p-5">
                  <h3 className="mb-3 text-sm font-semibold text-ink">Performa per Jenis Konten</h3>
                  {igTypeBreakdown.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Belum ada konten pada periode ini.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr style={{ color: "var(--ink-soft)" }}>
                            <th className="py-2 pr-3 font-medium">Jenis</th>
                            <th className="py-2 pr-3 font-medium text-right">Jml</th>
                            <th className="py-2 pr-3 font-medium text-right">Tayangan</th>
                            <th className="py-2 pr-3 font-medium text-right">ER</th>
                            <th className="py-2 pr-3 font-medium text-right">+Follower</th>
                          </tr>
                        </thead>
                        <tbody>
                          {igTypeBreakdown.map((t) => (
                            <tr key={t.type} className="border-t" style={{ borderColor: "rgba(0,60,68,.08)" }}>
                              <td className="py-2 pr-3 font-medium text-ink">{t.type}</td>
                              <td className="py-2 pr-3 text-right">{fmt(t.count)}</td>
                              <td className="py-2 pr-3 text-right">{fmt(t.views)}</td>
                              <td className="py-2 pr-3 text-right">{t.er == null ? "—" : `${t.er}%`}</td>
                              <td className="py-2 pr-3 text-right" style={{ color: "#166534" }}>{t.follows ? `+${fmt(t.follows)}` : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="card-3d p-4 sm:p-5">
                  <h3 className="mb-3 text-sm font-semibold text-ink"># Hashtag Instagram</h3>
                  {igHashtags.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Belum ada hashtag di caption.</p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {igHashtags.map((h) => (
                        <span
                          key={h.hashtag}
                          title={`${h.count}x dipakai · avg ${fmt(h.avgViews)} tayangan · ER ${h.avgEr}%`}
                          className="rounded-full px-3 py-1 font-medium"
                          style={{ background: "rgba(193,53,132,.08)", color: "#a12472", fontSize: `${12 + Math.min(8, h.count)}px` }}
                        >
                          {h.hashtag} <b>{h.count}</b>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Top konten IG (by tayangan) sudah di Ringkasan Platform; di sini
                  hanya "Pendatang Follower Terbanyak" (metrik follower, bukan views). */}
              <section className="card-3d p-4 sm:p-6">
                <h3 className="mb-1 text-sm font-semibold text-ink">Pendatang Follower Terbanyak</h3>
                <p className="mb-3 text-[11px]" style={{ color: "var(--ink-soft)" }}>Konten yang paling banyak menghasilkan follower baru — jenis yang layak diperbanyak.</p>
                {igTopFollows.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Belum ada konten yang tercatat mendatangkan follower.</p>
                ) : (
                  <IgContentTable rows={igTopFollows} valueKey="follows" valueLabel="+Follower" fmt={fmt} accent="#166534" />
                )}
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}

// Tabel ringkas Top konten IG (dipakai 2x: by tayangan & by follower). valueKey =
// kolom angka utama; selalu tampilkan jenis, caption ber-link, ER.
function IgContentTable({ rows = [], valueKey, valueLabel, fmt, accent }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr style={{ color: "var(--ink-soft)" }}>
            <th className="py-2 pr-2 font-medium">#</th>
            <th className="py-2 pr-3 font-medium">Konten</th>
            <th className="py-2 pr-3 font-medium">Jenis</th>
            <th className="py-2 pr-3 font-medium text-right">{valueLabel}</th>
            <th className="py-2 pr-3 font-medium text-right">ER</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => (
            <tr key={c.post_id || i} className="border-t align-top" style={{ borderColor: "rgba(0,60,68,.08)" }}>
              <td className="py-2 pr-2 text-[12px]" style={{ color: "var(--ink-soft)" }}>{i + 1}</td>
              <td className="max-w-xs py-2 pr-3">
                <a href={c.permalink || "#"} target="_blank" rel="noopener noreferrer" className="line-clamp-1 font-medium text-ink hover:underline" title={c.description || ""}>
                  {(c.description || "(tanpa caption)").split("\n")[0]}
                </a>
              </td>
              <td className="whitespace-nowrap py-2 pr-3 text-[12px]" style={{ color: "var(--ink-soft)" }}>{String(c.post_type || "").replace(/\s*IG$/i, "") || "—"}</td>
              <td className="whitespace-nowrap py-2 pr-3 text-right font-semibold" style={accent ? { color: accent } : { color: "var(--ink)" }}>
                {valueKey === "follows" ? `+${fmt(c[valueKey] || 0)}` : fmt(c[valueKey] || 0)}
              </td>
              <td className="whitespace-nowrap py-2 pr-3 text-right">{c.er == null ? "—" : `${c.er}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
