// File: components/PortfolioSummary.jsx
// Ringkasan atas Dashboard (KPI portofolio + tabel Ranking Cabang) dgn TOGGLE
// platform TikTok / Instagram. Kedua dataset dirender di server & dioper ke sini;
// toggle hanya memilih mana yang tampil (ganti instan, tanpa reload). Filter
// kategori tetap lewat URL (Link) karena mengubah komposisi cabang di server.
//
// Sengaja TANPA opsi "Gabungan": views TikTok (video) dan IG (termasuk Story)
// tidak setara, menjumlahkannya menyesatkan. Bandingkan berdampingan via toggle.

"use client";

import { useState } from "react";
import Link from "next/link";
import MetricCard from "@/components/MetricCard";

const fmt = (n) => Number(n || 0).toLocaleString("id-ID");
const STATUS_STYLE = {
  naik: { background: "#dcfce7", color: "#166534" },
  stabil: { background: "#fef9c3", color: "#854d0e" },
  turun: { background: "#fee2e2", color: "#991b1b" },
};

function dashboardHref({ cat, month } = {}) {
  const p = new URLSearchParams();
  if (cat) p.set("cat", cat);
  if (month) p.set("month", month);
  const qs = p.toString();
  return qs ? `/dashboard?${qs}` : "/dashboard";
}

export default function PortfolioSummary({
  tiktok, instagram, categories = [], catFilter = null, selectedMonth = null, monthLabel = "",
}) {
  const [platform, setPlatform] = useState("tiktok");
  const isIg = platform === "instagram";
  const cur = isIg ? instagram : tiktok;
  const p = cur.portfolio;
  const ranked = cur.ranked;
  const accent = isIg ? "#c13584" : "#006674";
  const igEmpty = isIg && p.activeBranches === 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Toggle platform */}
      <div className="flex items-center gap-2 px-1">
        {[["tiktok", "🎵 TikTok"], ["instagram", "📸 Instagram"]].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setPlatform(key)}
            className="rounded-full px-4 py-1.5 text-sm font-semibold transition-all"
            style={platform === key
              ? { background: "#fff", color: key === "instagram" ? "#a12472" : "var(--teal-900)", boxShadow: "0 4px 12px rgba(0,0,0,.18)" }
              : { background: "rgba(255,255,255,.15)", color: "rgba(255,255,255,.9)" }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* KPI portofolio */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard icon={isIg ? "📸" : "🏢"} accent="teal" label={isIg ? "Cabang punya data IG" : "Cabang aktif"} value={fmt(p.activeBranches)} />
        <MetricCard icon="🎬" accent="amber" label={selectedMonth ? `Konten ${monthLabel}` : "Konten bulan ini"} value={fmt(p.totalContentThisMonth)} />
        <MetricCard icon="👁️" accent="blue" label={isIg ? "Tayangan konten" : "Total views"} value={fmt(p.totalViews)} />
        <MetricCard icon="💬" accent="green" label="Avg engagement rate" value={`${p.avgEngagementRate}%`} />
      </section>

      {/* Ranking cabang */}
      <section className="card-3d p-4 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-ink">Ranking Cabang</h2>
          <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${accent}1a`, color: isIg ? "#a12472" : "var(--teal-900)" }}>
            {isIg ? "Instagram" : "TikTok"}
          </span>
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

        {igEmpty && (
          <p className="mb-3 rounded-xl px-3 py-2 text-xs" style={{ background: "rgba(193,53,132,.08)", color: "#a12472" }}>
            Belum ada cabang yang meng-upload data Instagram. Upload export Meta Business Suite di halaman Upload; angka di bawah akan terisi otomatis.
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr style={{ color: "var(--ink-soft)" }}>
                <th className="py-2 pr-3 font-medium">Cabang</th>
                <th className="py-2 pr-3 font-medium">Kategori</th>
                <th className="py-2 pr-3 font-medium">Konten/bln</th>
                <th className="py-2 pr-3 font-medium">{isIg ? "Tayangan" : "Views"}</th>
                <th className="py-2 pr-3 font-medium">Eng. rate</th>
                <th className="py-2 pr-3 font-medium">Follower Δ</th>
                <th className="py-2 pr-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((b) => (
                <tr key={b.id} className="border-t" style={{ borderColor: "rgba(0,60,68,.1)", opacity: isIg && !b.hasData ? 0.5 : 1 }}>
                  <td className="py-2 pr-3 font-medium text-ink">
                    {b.nama_cabang}
                    {b.tiktok_username ? <span style={{ color: "var(--ink-soft)" }}> @{b.tiktok_username}</span> : null}
                  </td>
                  <td className="py-2 pr-3" style={{ color: "var(--ink-soft)" }}>{b.kategori || "-"}</td>
                  <td className="py-2 pr-3">{fmt(b.contentThisMonth)}</td>
                  <td className="py-2 pr-3">{fmt(b.totalViews)}</td>
                  <td className="py-2 pr-3">{b.engagementRate}%</td>
                  <td className="py-2 pr-3">{b.netFollowerGrowth >= 0 ? `+${fmt(b.netFollowerGrowth)}` : fmt(b.netFollowerGrowth)}</td>
                  <td className="py-2 pr-3">
                    <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={STATUS_STYLE[b.status] || STATUS_STYLE.stabil}>{b.status}</span>
                  </td>
                </tr>
              ))}
              {ranked.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center" style={{ color: "var(--ink-soft)" }}>Belum ada cabang untuk kategori ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
