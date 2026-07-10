// File: app/report/portfolio/page.jsx
// Laporan "Semua Cabang" (tabular/dashboard korporat, §9) — beda gaya dari laporan
// per-akun (infografis). Bisa cetak → Simpan PDF, atau download Excel. RLS-aware.

import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadPortfolio } from "@/lib/tiktok/analytics";
import { BarChartLabeled } from "@/components/Charts";
import PrintButton from "@/components/PrintButton";
import Button from "@/components/Button";
import MonthFilter from "@/components/MonthFilter";

const fmt = (n) => Number(n || 0).toLocaleString("id-ID");
const BULAN_NAMA = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
function labelBulan(ym) {
  const [y, m] = ym.split("-");
  return `${BULAN_NAMA[Number(m) - 1] || m} ${y}`;
}

const STATUS_STYLE = {
  naik: { background: "#dcfce7", color: "#166534" },
  stabil: { background: "#fef9c3", color: "#854d0e" },
  turun: { background: "#fee2e2", color: "#991b1b" },
};

export default async function PortfolioReportPage({ searchParams }) {
  const profile = await getCurrentProfile();
  if (!profile?.role) return <main className="relative z-10 p-8 text-white">Silakan login.</main>;

  const sp = (await searchParams) || {};
  const month = /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : null;

  const supabase = await createSupabaseServerClient();
  const { branches, portfolio, months } = await loadPortfolio(supabase, { month });

  return (
    <main className="relative z-10 mx-auto w-full max-w-5xl p-4 sm:p-6">
      <div className="no-print mb-4 flex flex-wrap items-center gap-3">
        <Link href="/report"><Button variant="ghost">← Laporan</Button></Link>
        <a href={`/api/report/portfolio-excel${month ? `?month=${month}` : ""}`}><Button variant="success">⬇️ Download Excel</Button></a>
        <PrintButton />
        <div className="ml-auto"><MonthFilter months={months} /></div>
      </div>

      <article className="card-3d p-6 sm:p-8">
        <header className="mb-6 border-b pb-4" style={{ borderColor: "rgba(0,60,68,.15)" }}>
          <h1 className="text-xl font-bold text-ink">Laporan Semua Cabang{month ? ` — ${labelBulan(month)}` : ""}</h1>
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Ringkasan portofolio · {portfolio.activeBranches} cabang aktif{!month && " · sepanjang masa"}</p>
        </header>

        {/* KPI portofolio */}
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Total Views", fmt(portfolio.totalViews)],
            [month ? `Konten ${labelBulan(month)}` : "Konten Bulan Ini", fmt(portfolio.totalContentThisMonth)],
            ["Avg Eng. Rate", `${portfolio.avgEngagementRate}%`],
            ["Net Follower", `${portfolio.netFollowerGrowth >= 0 ? "+" : ""}${fmt(portfolio.netFollowerGrowth)}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl p-3 text-center" style={{ background: "linear-gradient(160deg,#f1fbf3,#e3f4e8)" }}>
              <div className="text-xl font-bold text-ink">{value}</div>
              <div className="text-xs" style={{ color: "var(--ink-soft)" }}>{label}</div>
            </div>
          ))}
        </section>

        {/* Tabel ranking */}
        <section className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-ink">Ranking Cabang</h3>
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
                    <td className="py-2 pr-3 font-medium text-ink">{b.nama_cabang}{b.tiktok_username ? ` @${b.tiktok_username}` : ""}</td>
                    <td className="py-2 pr-3">{fmt(b.contentThisMonth)}</td>
                    <td className="py-2 pr-3">{fmt(b.totalViews)}</td>
                    <td className="py-2 pr-3">{b.engagementRate}%</td>
                    <td className="py-2 pr-3">{b.netFollowerGrowth >= 0 ? `+${fmt(b.netFollowerGrowth)}` : fmt(b.netFollowerGrowth)}</td>
                    <td className="py-2 pr-3"><span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={STATUS_STYLE[b.status] || STATUS_STYLE.stabil}>{b.status}</span></td>
                  </tr>
                ))}
                {branches.length === 0 && <tr><td colSpan={6} className="py-4 text-center" style={{ color: "var(--ink-soft)" }}>Belum ada cabang.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {/* Perbandingan views antar cabang */}
        {branches.length > 0 && (
          <section>
            <h3 className="mb-3 text-sm font-semibold text-ink">Perbandingan Total Views Antar Cabang</h3>
            <BarChartLabeled
              data={branches.map((b) => ({ label: b.nama_cabang.slice(0, 10), value: b.totalViews }))}
              format={(v) => fmt(v)}
            />
          </section>
        )}
      </article>
    </main>
  );
}
