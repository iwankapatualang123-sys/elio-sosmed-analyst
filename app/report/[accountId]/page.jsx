// File: app/report/[accountId]/page.jsx
// Laporan infografis satu halaman per cabang (blueprint bagian 8). Bisa "Simpan
// sebagai PDF" lewat tombol cetak, atau download Excel. Server Component + RLS.

import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadBranchDetail } from "@/lib/tiktok/analytics";
import { LineChart, Donut, BarChartLabeled } from "@/components/Charts";
import PrintButton from "@/components/PrintButton";
import Button from "@/components/Button";
import MonthFilter from "@/components/MonthFilter";

const fmt = (n) => Number(n || 0).toLocaleString("id-ID");
const BULAN_NAMA = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
function labelBulan(ym) {
  const [y, m] = ym.split("-");
  return `${BULAN_NAMA[Number(m) - 1] || m} ${y}`;
}

export default async function ReportPage({ params, searchParams }) {
  const { accountId } = await params;
  const profile = await getCurrentProfile();
  if (!profile?.role) {
    return <main className="relative z-10 p-8 text-white">Silakan login.</main>;
  }

  const sp = (await searchParams) || {};
  const month = /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : null;

  const supabase = await createSupabaseServerClient();
  const { data: account } = await supabase
    .from("tiktok_accounts").select("nama_cabang, tiktok_username").eq("id", accountId).maybeSingle();
  const detail = await loadBranchDetail(supabase, accountId, { month });
  if (!account || !detail) {
    return <main className="relative z-10 p-8 text-white">Cabang tidak ditemukan atau tidak ada akses.</main>;
  }

  const s = detail.summary;
  const g = detail.growth;

  return (
    <main className="relative z-10 mx-auto w-full max-w-4xl p-4 sm:p-6">
      {/* Toolbar (tidak ikut tercetak) */}
      <div className="no-print mb-4 flex flex-wrap items-center gap-3">
        <Link href="/report"><Button variant="ghost">← Laporan</Button></Link>
        <a href={`/api/report/excel?branch=${accountId}${month ? `&month=${month}` : ""}`}><Button variant="success">⬇️ Download Excel</Button></a>
        <PrintButton />
        <div className="ml-auto"><MonthFilter months={detail.months} /></div>
      </div>

      <article className="card-3d p-6 sm:p-8">
        {/* Header */}
        <header className="mb-6 flex items-center gap-4 border-b pb-4" style={{ borderColor: "rgba(0,60,68,.15)" }}>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold text-white" style={{ background: "linear-gradient(180deg,#0a8291,#00545e)" }}>TT</div>
          <div>
            <h1 className="text-xl font-bold text-ink">Laporan Performa TikTok{month ? ` — ${labelBulan(month)}` : ""}</h1>
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>{account.nama_cabang} · @{account.tiktok_username}{!month && " · sepanjang masa"}</p>
          </div>
        </header>

        {/* KPI */}
        <section className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["Total Views", fmt(s.totalViews)],
            ["Total Konten", fmt(s.totalVideos)],
            ["Engagement Rate", `${s.engagementRateOverall}%`],
            ["Net Follower", `${g.netGrowth >= 0 ? "+" : ""}${fmt(g.netGrowth)}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl p-3 text-center" style={{ background: "linear-gradient(160deg,#f1fbf3,#e3f4e8)" }}>
              <div className="text-xl font-bold text-ink">{value}</div>
              <div className="text-xs" style={{ color: "var(--ink-soft)" }}>{label}</div>
            </div>
          ))}
        </section>

        {/* Grafik */}
        <section className="mb-6 grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Tren Follower ({fmt(g.startFollowers)} → {fmt(g.endFollowers)})</h3>
            <LineChart data={detail.history.map((h) => ({ x: h.date, y: h.followers }))} height={150} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Jam Terbaik</h3>
            <BarChartLabeled data={detail.bestHours.topHours.map((h) => ({ label: `${String(h.hour).padStart(2, "0")}:00`, value: h.avgActive }))} height={150} format={(v) => Math.round(v)} />
          </div>
          {detail.gender && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">Gender Follower</h3>
              <Donut size={130} data={[
                { label: "Pria", value: Number(detail.gender.male_pct) || 0, color: "#2c5f9e" },
                { label: "Wanita", value: Number(detail.gender.female_pct) || 0, color: "#c85a8a" },
                { label: "Lainnya", value: Number(detail.gender.other_pct) || 0, color: "#93bcad" },
              ]} />
            </div>
          )}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Penonton Baru vs Kembali</h3>
            <Donut size={130} center={`${detail.viewers.newPct}%`} data={[
              { label: "Baru", value: detail.viewers.totalNew, color: "#4f9e7a" },
              { label: "Kembali", value: detail.viewers.totalReturning, color: "#006674" },
            ]} />
          </div>
        </section>

        {/* Key Takeaways */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-ink">Key Takeaways</h3>
          <ul className="flex flex-col gap-2">
            {(detail.insights || []).map((i, idx) => (
              <li key={idx} className="rounded-xl p-3 text-sm" style={{ background: "rgba(0,102,116,.05)" }}>
                <b className="text-ink">{i.aspek}:</b> <span className="text-ink">{i.kesimpulan}</span>
                <span style={{ color: "var(--ink-soft)" }}> — {i.saran}</span>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </main>
  );
}
