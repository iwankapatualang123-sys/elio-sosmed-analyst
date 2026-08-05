// File: components/umum/TopKonten.jsx
// "Top Konten — Top Performance": 5 konten terbaik LINTAS semua outlet & platform,
// mengikuti filter kategori & bulan halaman. Toggle dasar urutan: Views / ER.
// Client component (toggle instan). Thumbnail TikTok diambil via oEmbed di browser
// (components/Thumbnail.jsx); Instagram tak punya thumbnail publik → placeholder.

"use client";

import { useState } from "react";
import Thumbnail from "@/components/Thumbnail";

const fmt = (n) => Number(n || 0).toLocaleString("id-ID");
function ringkas(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}Jt`;
  if (v >= 1_000) return `${Math.round(v / 1000)}rb`;
  return fmt(v);
}

const BADGE = {
  tiktok: { label: "TikTok", bg: "#ececec", fg: "#111" },
  instagram: { label: "Instagram", bg: "#fce4f1", fg: "#a12472" },
  threads: { label: "Threads", bg: "#e8eaf1", fg: "#333" },
};

// Placeholder thumbnail (IG/Threads) — kotak gradien + ikon, konsisten & ringan.
function Placeholder({ platform }) {
  const bg = platform === "instagram"
    ? "linear-gradient(135deg,#f6c9e0,#e78fc0)"
    : "linear-gradient(135deg,#c7cbf5,#9aa0ee)";
  return (
    <div style={{ width: 46, height: 58, borderRadius: 9, background: bg, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.9)", fontSize: 15, flexShrink: 0 }}>
      {platform === "instagram" ? "📸" : "▶"}
    </div>
  );
}

export default function TopKonten({ byViews = [], byEr = [], hasEr = true }) {
  const [mode, setMode] = useState("views");
  const rows = mode === "er" ? byEr : byViews;

  return (
    <section className="card-3d p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-ink">🏆 Top Konten — Top Performance</h3>
        <div className="ml-auto inline-flex items-center rounded-full p-1" style={{ background: "#f1f2f7", border: "1px solid var(--line)" }}>
          {[["views", "Views"], ["er", "Engagement Rate"]].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              disabled={key === "er" && !hasEr}
              className="rounded-full px-3.5 py-1 text-xs font-semibold transition-all disabled:opacity-40"
              style={mode === key
                ? { background: "#fff", color: "var(--teal-900)", boxShadow: "0 1px 3px rgba(16,24,40,.14)" }
                : { background: "transparent", color: "var(--ink-soft)" }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-[11px]" style={{ color: "var(--ink-soft)" }}>
        5 konten terbaik lintas semua outlet &amp; platform (mengikuti filter kategori &amp; bulan di atas).
        {mode === "er" && " Hanya konten dengan tayangan cukup yang diperingkat ER."}
      </p>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm" style={{ color: "var(--ink-soft)" }}>Belum ada konten pada periode ini.</p>
      ) : (
        <div className="mt-3 flex flex-col">
          {rows.map((c, i) => {
            const badge = BADGE[c.platform] || BADGE.tiktok;
            return (
              <div key={c.key} className="flex items-center gap-3 border-b py-2.5" style={{ borderColor: "#f1f2f7" }}>
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold" style={{ background: "var(--pri-50,#eef0fe)", color: "var(--teal-900)" }}>{i + 1}</span>
                {c.platform === "tiktok"
                  ? <Thumbnail link={c.link} width={46} height={58} />
                  : <Placeholder platform={c.platform} />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-ink" title={c.title}>
                    {c.link
                      ? <a href={c.link} target="_blank" rel="noopener noreferrer" className="hover:underline">{c.title}</a>
                      : c.title}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px]" style={{ color: "var(--ink-soft)" }}>
                    <span className="truncate">{c.outlet}</span>
                    <span className="rounded px-1.5 py-0.5 text-[9.5px] font-bold" style={{ background: badge.bg, color: badge.fg }}>{badge.label}</span>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right" style={{ width: 68 }}>
                  <div className="text-sm font-extrabold text-ink">{ringkas(c.views)}</div>
                  <div className="text-[9.5px] uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Views</div>
                </div>
                <div className="flex-shrink-0 text-right" style={{ width: 52 }}>
                  <div className="text-sm font-extrabold text-ink">{c.er == null ? "—" : `${c.er}%`}</div>
                  <div className="text-[9.5px] uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>ER</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
