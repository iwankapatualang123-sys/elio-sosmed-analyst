// File: app/dashboard/page.jsx
// Dashboard analitik TikTok (terproteksi). Server Component: muat metrik lintas
// cabang (KPI + ranking) dan detail 1 cabang (grafik). Blueprint bagian 4.

import { getCurrentProfile, canWrite } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadPortfolio, loadBranchDetail } from "@/lib/tiktok/analytics";
import Link from "next/link";
import Nav from "@/components/Nav";
import MetricCard from "@/components/MetricCard";
import MonthFilter from "@/components/MonthFilter";
import { LineChart, Donut, BarChartLabeled, Heatmap } from "@/components/Charts";
import InsightAI from "@/components/InsightAI";
import OnboardingTips from "@/components/OnboardingTips";
import ProgressBar from "@/components/ProgressBar";
import { forecastNext } from "@/lib/tiktok/forecast";
import { matchPlanStatusMulti, summarizePlans } from "@/lib/tiktok/content-plan";
import { setGoals, addAnnotation, deleteAnnotation } from "./actions";

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

const STATUS_STYLE = {
  naik: { background: "#dcfce7", color: "#166534" },
  stabil: { background: "#fef9c3", color: "#854d0e" },
  turun: { background: "#fee2e2", color: "#991b1b" },
};

// Warna badge 5 status Rencana Konten (samakan dgn ContentPlanBoard).
const PLAN_BADGE = {
  "On Going": { bg: "rgba(3,105,161,.1)", fg: "#0369a1" },
  Uploaded: { bg: "rgba(124,58,237,.1)", fg: "#7c3aed" },
  Verified: { bg: "rgba(22,101,52,.1)", fg: "#166534" },
  Cancelled: { bg: "rgba(180,83,9,.1)", fg: "#b45309" },
  Replaced: { bg: "rgba(161,98,7,.1)", fg: "#a16207" },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.stabil;
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={s}>
      {status}
    </span>
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
  const selectedId = sp.branch || branches[0]?.id || null;
  const catFilter = sp.cat || null;
  const categories = [...new Set(branches.map((b) => b.kategori).filter(Boolean))];
  const rankedBranches = catFilter ? branches.filter((b) => b.kategori === catFilter) : branches;
  const detail = await loadBranchDetail(supabase, selectedId, { month: selectedMonth });
  const selectedBranch = branches.find((b) => b.id === selectedId);
  const { data: goal } = selectedId
    ? await supabase.from("tiktok_account_goals").select("*").eq("tiktok_account_id", selectedId).maybeSingle()
    : { data: null };
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

      {/* KPI portofolio */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard icon="🏢" accent="teal" label="Cabang aktif" value={fmt(portfolio.activeBranches)} />
        <MetricCard icon="🎬" accent="amber" label={selectedMonth ? `Konten ${labelBulan(selectedMonth)}` : "Konten bulan ini"} value={fmt(portfolio.totalContentThisMonth)} />
        <MetricCard icon="👁️" accent="blue" label="Total views" value={fmt(portfolio.totalViews)} />
        <MetricCard icon="💬" accent="green" label="Avg engagement rate" value={`${portfolio.avgEngagementRate}%`} />
      </section>

      {/* Ranking cabang */}
      <section className="card-3d p-4 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-ink">Ranking Cabang</h2>
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <Link href={dashboardHref({ month: selectedMonth })} className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={!catFilter ? { background: "var(--teal-700)", color: "#fff" } : { background: "rgba(0,102,116,.08)", color: "var(--teal-900)" }}>Semua</Link>
              {categories.map((c) => (
                <Link key={c} href={dashboardHref({ cat: c, month: selectedMonth })} className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={catFilter === c ? { background: "var(--teal-700)", color: "#fff" } : { background: "rgba(0,102,116,.08)", color: "var(--teal-900)" }}>{c}</Link>
              ))}
            </div>
          )}
          <Link href="/report/portfolio" className="ml-auto rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "rgba(0,102,116,.1)", color: "var(--teal-900)" }}>
            📄 Laporan Semua Cabang
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr style={{ color: "var(--ink-soft)" }}>
                <th className="py-2 pr-3 font-medium">Cabang</th>
                <th className="py-2 pr-3 font-medium">Kategori</th>
                <th className="py-2 pr-3 font-medium">Konten/bln</th>
                <th className="py-2 pr-3 font-medium">Views</th>
                <th className="py-2 pr-3 font-medium">Eng. rate</th>
                <th className="py-2 pr-3 font-medium">Follower Δ</th>
                <th className="py-2 pr-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rankedBranches.map((b) => (
                <tr key={b.id} className="border-t" style={{ borderColor: "rgba(0,60,68,.1)" }}>
                  <td className="py-2 pr-3 font-medium text-ink">
                    {b.nama_cabang}
                    {b.tiktok_username ? <span style={{ color: "var(--ink-soft)" }}> @{b.tiktok_username}</span> : null}
                  </td>
                  <td className="py-2 pr-3" style={{ color: "var(--ink-soft)" }}>{b.kategori || "-"}</td>
                  <td className="py-2 pr-3">{fmt(b.contentThisMonth)}</td>
                  <td className="py-2 pr-3">{fmt(b.totalViews)}</td>
                  <td className="py-2 pr-3">{b.engagementRate}%</td>
                  <td className="py-2 pr-3">{b.netFollowerGrowth >= 0 ? `+${fmt(b.netFollowerGrowth)}` : fmt(b.netFollowerGrowth)}</td>
                  <td className="py-2 pr-3"><StatusBadge status={b.status} /></td>
                </tr>
              ))}
              {rankedBranches.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center" style={{ color: "var(--ink-soft)" }}>Belum ada cabang untuk kategori ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

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

          {/* Target & Progress (blueprint 21A) — SENGAJA selalu sepanjang masa, tidak
              ikut filter bulan di atas (target itu tujuan berjalan, bukan target per bulan). */}
          <section className="card-3d p-4 sm:p-5">
            <h3 className="mb-3 text-sm font-semibold text-ink">🎯 Target & Progress</h3>
            {selectedMonth && (
              <p className="mb-3 text-xs" style={{ color: "var(--ink-soft)" }}>Progress dihitung sepanjang masa (tidak mengikuti filter bulan di atas).</p>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <ProgressBar label="Total Views" current={detail.allTime.summary.totalViews} target={goal?.target_total_views} />
              <ProgressBar label="Engagement Rate" current={detail.allTime.summary.engagementRateOverall} target={goal?.target_engagement_rate} suffix="%" />
              <ProgressBar label="Net Follower" current={detail.allTime.growth.netGrowth} target={goal?.target_net_followers} />
            </div>
            {editable && (
              <form action={setGoals} className="mt-4 border-t pt-3" style={{ borderColor: "rgba(0,60,68,.1)" }}>
                <input type="hidden" name="accountId" value={selectedId} />
                <p className="mb-2 text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>Ubah target</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="flex flex-col gap-1 text-xs font-medium text-ink">
                    Target Total Views
                    <input name="target_total_views" className="input-3d !min-h-0 !py-1.5 text-sm" placeholder="mis. 50000" defaultValue={goal?.target_total_views ?? ""} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-ink">
                    Target Engagement Rate (%)
                    <input name="target_engagement_rate" className="input-3d !min-h-0 !py-1.5 text-sm" placeholder="mis. 6" defaultValue={goal?.target_engagement_rate ?? ""} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-ink">
                    Target Net Follower
                    <input name="target_net_followers" className="input-3d !min-h-0 !py-1.5 text-sm" placeholder="mis. 10" defaultValue={goal?.target_net_followers ?? ""} />
                  </label>
                </div>
                <div className="mt-3 flex justify-end">
                  <button type="submit" className="btn btn-primary !min-h-0 !px-4 !py-1.5 text-sm">Simpan target</button>
                </div>
              </form>
            )}
          </section>

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

          {/* Insight otomatis (Kesimpulan + Saran per aspek) */}
          <section className="grid gap-4 sm:grid-cols-2">
            {(detail.insights || []).map((ins, i) => (
              <div key={i} className="card-3d p-4">
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
          </section>

          <InsightAI accountId={selectedId} namaCabang={selectedBranch.nama_cabang} month={selectedMonth} />

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="card-3d p-5">
              <h3 className="mb-1 text-sm font-semibold text-ink">Pertumbuhan Follower{selectedMonth ? ` — ${labelBulan(selectedMonth)}` : ""}</h3>
              <p className="mb-3 text-xs" style={{ color: "var(--ink-soft)" }}>
                {detail.growth.startFollowers} → {detail.growth.endFollowers} ({detail.growth.netGrowth >= 0 ? "+" : ""}{detail.growth.netGrowth})
                {/* Proyeksi cuma masuk akal meramal maju dari data terkini — disembunyikan saat meninjau bulan lampau. */}
                {!selectedMonth && detail.history.length >= 2 && (() => {
                  const fc = forecastNext(detail.history.map((h) => h.followers), 7);
                  return <span> · proyeksi 7 hari: <b style={{ color: fc.trend === "naik" ? "#166534" : fc.trend === "turun" ? "#991b1b" : "inherit" }}>~{fmt(fc.nextValue)} ({fc.trend})</b></span>;
                })()}
              </p>
              <LineChart data={detail.history.map((h) => ({ x: h.date, y: h.followers }))} />
            </div>

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
              <h3 className="mb-0.5 text-sm font-semibold text-ink">Gender Follower</h3>
              {/* Ini snapshot (potret sesaat) — dgn filter bulan, ambil snapshot terakhir
                  yang sudah ada PADA/sebelum bulan itu, bukan snapshot dari masa depan. */}
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
            <h3 className="mb-1 text-sm font-semibold text-ink">Heatmap Jam × Hari (follower aktif)</h3>
            {detail.activityRange ? (
              <>
                <p className="mb-3 text-xs" style={{ color: "var(--ink-soft)" }}>Dari aktivitas 7 hari terakhir ({tglSingkat(detail.activityRange.from)}–{tglSingkat(detail.activityRange.to)}) — bukan per-bulan.</p>
                <Heatmap heatmap={detail.bestHours.heatmap} />
              </>
            ) : (
              <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Belum ada data aktivitas follower per jam.</p>
            )}
          </section>

          <section className="card-3d p-4 sm:p-6">
            <h3 className="mb-3 text-sm font-semibold text-ink">Top 5 Video (by views){selectedMonth ? ` — ${labelBulan(selectedMonth)}` : ""}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr style={{ color: "var(--ink-soft)" }}>
                    <th className="py-2 pr-3 font-medium">#</th>
                    <th className="py-2 pr-3 font-medium">Judul</th>
                    <th className="py-2 pr-3 font-medium">Views</th>
                    <th className="py-2 pr-3 font-medium">Eng. rate</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.topVideos.map((v, i) => (
                    <tr key={v.video_id || i} className="border-t" style={{ borderColor: "rgba(0,60,68,.1)" }}>
                      <td className="py-2 pr-3">{i + 1}</td>
                      <td className="py-2 pr-3 text-ink"><span className="line-clamp-1 max-w-md">{v.video_title || "(tanpa judul)"}</span></td>
                      <td className="py-2 pr-3">{fmt(v.total_views)}</td>
                      <td className="py-2 pr-3">{v.engagement_rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
