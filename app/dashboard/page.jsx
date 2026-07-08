// File: app/dashboard/page.jsx
// Dashboard analitik TikTok (terproteksi). Server Component: muat metrik lintas
// cabang (KPI + ranking) dan detail 1 cabang (grafik). Blueprint bagian 4.

import { getCurrentProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadPortfolio, loadBranchDetail } from "@/lib/tiktok/analytics";
import Link from "next/link";
import Nav from "@/components/Nav";
import MetricCard from "@/components/MetricCard";
import { LineChart, Donut, BarChartLabeled, Heatmap } from "@/components/Charts";
import InsightAI from "@/components/InsightAI";

const INSIGHT_STYLE = {
  naik: { background: "#dcfce7", color: "#166534" },
  turun: { background: "#fee2e2", color: "#991b1b" },
  stabil: { background: "#fef9c3", color: "#854d0e" },
  info: { background: "#e0f2fe", color: "#075985" },
};

const fmt = (n) => Number(n || 0).toLocaleString("id-ID");

const STATUS_STYLE = {
  naik: { background: "#dcfce7", color: "#166534" },
  stabil: { background: "#fef9c3", color: "#854d0e" },
  turun: { background: "#fee2e2", color: "#991b1b" },
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
  const { branches, portfolio } = await loadPortfolio(supabase);
  const sp = (await searchParams) || {};
  const selectedId = sp.branch || branches[0]?.id || null;
  const detail = await loadBranchDetail(supabase, selectedId);
  const selectedBranch = branches.find((b) => b.id === selectedId);

  return (
    <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <Nav email={profile.email} role={profile.role} />

      {/* KPI portofolio */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard icon="🏢" accent="teal" label="Cabang aktif" value={fmt(portfolio.activeBranches)} />
        <MetricCard icon="🎬" accent="amber" label="Konten bulan ini" value={fmt(portfolio.totalContentThisMonth)} />
        <MetricCard icon="👁️" accent="blue" label="Total views" value={fmt(portfolio.totalViews)} />
        <MetricCard icon="💬" accent="green" label="Avg engagement rate" value={`${portfolio.avgEngagementRate}%`} />
      </section>

      {/* Ranking cabang */}
      <section className="card-3d p-4 sm:p-6">
        <h2 className="mb-3 text-base font-semibold text-ink">Ranking Cabang</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr style={{ color: "var(--ink-soft)" }}>
                <th className="py-2 pr-3 font-medium">Cabang</th>
                <th className="py-2 pr-3 font-medium">Konten/bln</th>
                <th className="py-2 pr-3 font-medium">Views</th>
                <th className="py-2 pr-3 font-medium">Eng. rate</th>
                <th className="py-2 pr-3 font-medium">Follower Δ</th>
                <th className="py-2 pr-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => (
                <tr key={b.id} className="border-t" style={{ borderColor: "rgba(0,60,68,.1)" }}>
                  <td className="py-2 pr-3 font-medium text-ink">
                    {b.nama_cabang}
                    {b.tiktok_username ? <span style={{ color: "var(--ink-soft)" }}> @{b.tiktok_username}</span> : null}
                  </td>
                  <td className="py-2 pr-3">{fmt(b.contentThisMonth)}</td>
                  <td className="py-2 pr-3">{fmt(b.totalViews)}</td>
                  <td className="py-2 pr-3">{b.engagementRate}%</td>
                  <td className="py-2 pr-3">{b.netFollowerGrowth >= 0 ? `+${fmt(b.netFollowerGrowth)}` : fmt(b.netFollowerGrowth)}</td>
                  <td className="py-2 pr-3"><StatusBadge status={b.status} /></td>
                </tr>
              ))}
              {branches.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center" style={{ color: "var(--ink-soft)" }}>Belum ada cabang berisi data.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Detail 1 cabang */}
      {detail && selectedBranch && (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-white drop-shadow">
              Detail: {selectedBranch.nama_cabang}
            </h2>
            <Link
              href={`/report/${selectedId}`}
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
                    href={`/dashboard?branch=${b.id}`}
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

          <InsightAI accountId={selectedId} namaCabang={selectedBranch.nama_cabang} />

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="card-3d p-5">
              <h3 className="mb-1 text-sm font-semibold text-ink">Pertumbuhan Follower</h3>
              <p className="mb-3 text-xs" style={{ color: "var(--ink-soft)" }}>
                {detail.growth.startFollowers} → {detail.growth.endFollowers} ({detail.growth.netGrowth >= 0 ? "+" : ""}{detail.growth.netGrowth})
              </p>
              <LineChart data={detail.history.map((h) => ({ x: h.date, y: h.followers }))} />
            </div>

            <div className="card-3d p-5">
              <h3 className="mb-3 text-sm font-semibold text-ink">Jam Terbaik (follower aktif)</h3>
              <BarChartLabeled
                data={detail.bestHours.topHours.map((h) => ({ label: `${String(h.hour).padStart(2, "0")}:00`, value: h.avgActive }))}
                format={(v) => Math.round(v)}
              />
            </div>

            <div className="card-3d p-5">
              <h3 className="mb-3 text-sm font-semibold text-ink">Gender Follower</h3>
              {detail.gender ? (
                <Donut
                  data={[
                    { label: "Pria", value: Number(detail.gender.male_pct) || 0, color: "#2c5f9e" },
                    { label: "Wanita", value: Number(detail.gender.female_pct) || 0, color: "#c85a8a" },
                    { label: "Lainnya", value: Number(detail.gender.other_pct) || 0, color: "#93bcad" },
                  ]}
                />
              ) : (
                <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Belum ada data gender.</p>
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

          <section className="card-3d p-5">
            <h3 className="mb-3 text-sm font-semibold text-ink">Heatmap Jam × Hari (follower aktif)</h3>
            <Heatmap heatmap={detail.bestHours.heatmap} />
          </section>

          <section className="card-3d p-4 sm:p-6">
            <h3 className="mb-3 text-sm font-semibold text-ink">Top 5 Video (by views)</h3>
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
