// File: components/ContentGrid.jsx
// Galeri KONTEN sebagai grid kartu (client) — pengganti tabel untuk video/konten
// yang visual. 3 kolom di layar besar: thumbnail + judul + tanggal + metrik
// (views/likes/ER) + link. Dilengkapi cari & urutkan. Gaya profesional (seperti
// tool analitik konten). Baris konten memakai kolom snake_case dari DB TikTok.

"use client";

import { useMemo, useState } from "react";
import Thumbnail from "@/components/Thumbnail";

const fmt = (n) => Number(n || 0).toLocaleString("id-ID");
const HASHTAG_RE = /#[\p{L}\p{N}_]+/gu;

function erOf(r) {
  const v = Number(r.total_views) || 0;
  const e = (Number(r.total_likes) || 0) + (Number(r.total_comments) || 0) + (Number(r.total_shares) || 0);
  return v > 0 ? (e / v) * 100 : 0;
}

export default function ContentGrid({ rows = [], emptyText = "Belum ada konten." }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("date");

  const items = useMemo(() => {
    let a = rows;
    const s = q.trim().toLowerCase();
    if (s) a = a.filter((r) => String(r.video_title || "").toLowerCase().includes(s));
    const arr = [...a];
    arr.sort((x, y) => {
      if (sort === "views") return (Number(y.total_views) || 0) - (Number(x.total_views) || 0);
      if (sort === "likes") return (Number(y.total_likes) || 0) - (Number(x.total_likes) || 0);
      if (sort === "er") return erOf(y) - erOf(x);
      return String(y.post_date || "").localeCompare(String(x.post_date || "")); // terbaru dulu
    });
    return arr;
  }, [rows, q, sort]);

  if (!rows.length) {
    return <p className="text-sm" style={{ color: "var(--ink-soft)" }}>{emptyText}</p>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari judul…"
          className="input-3d !min-h-0 max-w-[220px] !py-1.5 text-sm"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="input-3d !min-h-0 w-auto !py-1.5 text-sm"
        >
          <option value="date">Terbaru</option>
          <option value="views">Views tertinggi</option>
          <option value="likes">Likes tertinggi</option>
          <option value="er">ER tertinggi</option>
        </select>
        <span className="ml-auto text-xs" style={{ color: "var(--ink-soft)" }}>{items.length} video</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((r, i) => {
          const title = String(r.video_title || "").trim();
          const tags = title.match(HASHTAG_RE) || [];
          const plain = title.replace(HASHTAG_RE, "").replace(/\s+/g, " ").trim() || "(tanpa judul)";
          const er = erOf(r);
          return (
            <div key={r.video_id || i} className="flex gap-3 rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "#fff" }}>
              <div className="flex-shrink-0 overflow-hidden rounded-lg" style={{ width: 64, height: 85, background: "#eef2f2" }}>
                {r.video_link ? (
                  <Thumbnail link={r.video_link} width={64} height={85} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg">🎬</div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="line-clamp-2 text-sm font-medium leading-snug text-ink" title={plain}>{plain}</p>
                {tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {tags.slice(0, 2).map((t, j) => (
                      <span key={j} className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: "rgba(0,102,116,.08)", color: "var(--teal-900)" }}>{t}</span>
                    ))}
                    {tags.length > 2 && <span className="text-[10px]" style={{ color: "var(--ink-soft)" }}>+{tags.length - 2}</span>}
                  </div>
                )}
                <div className="mt-auto pt-2 text-[11px]" style={{ color: "var(--ink-soft)" }}>{r.post_date || "-"}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                  <span className="font-semibold text-ink">{fmt(r.total_views)}<span className="font-normal" style={{ color: "var(--ink-soft)" }}> views</span></span>
                  <span style={{ color: "var(--ink-soft)" }}>❤ {fmt(r.total_likes)}</span>
                  <span className="font-semibold" style={{ color: er >= 4 ? "#15803d" : "var(--ink)" }}>{er.toFixed(1)}% ER</span>
                  {r.video_link && (
                    <a href={r.video_link} target="_blank" rel="noopener noreferrer" className="ml-auto font-semibold" style={{ color: "var(--teal-900)" }}>Buka ↗</a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
