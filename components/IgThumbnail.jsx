// File: components/IgThumbnail.jsx
// Thumbnail konten Instagram (client). Beda dgn TikTok: IG tidak punya oEmbed
// publik (butuh token Meta + App Review) dan memblokir fetch dari server/IP
// datacenter (403). Jadi strateginya:
//   1) coba endpoint legacy `<permalink>media/?size=m` LANGSUNG dari browser
//      user (kadang berhasil, terutama bila browser punya sesi Instagram),
//   2) gagal / jenis Story (tidak punya endpoint media) -> TILE ikon per jenis
//      konten (Reel/Gambar/Carousel/Cerita) yang tetap bisa diklik ke IG.
// Kalau kelak ada Meta app + oEmbed Read, tinggal ganti resolusi gambarnya —
// pemakaian komponen ini tidak berubah.

"use client";

import { useState } from "react";

// Ikon per jenis postingan ("Reel IG" / "Gambar IG" / "Carousel IG" / "Cerita IG").
function iconFor(postType) {
  const t = String(postType ?? "").toLowerCase();
  if (t.includes("reel")) return "🎬";
  if (t.includes("carousel")) return "🎠";
  if (t.includes("cerita") || t.includes("stor")) return "📖";
  if (t.includes("gambar") || t.includes("image") || t.includes("foto")) return "🖼️";
  return "📷";
}

// Hanya /p/, /reel/, /tv/ yang punya endpoint media; Story tidak.
function mediaUrl(link) {
  const m = String(link ?? "").match(/instagram\.com\/(p|reel|tv)\/[^/?#]+/i);
  return m ? `https://www.${m[0]}/media/?size=m` : null;
}

export default function IgThumbnail({ link, postType, width = 48, height = 64 }) {
  const src = mediaUrl(link);
  const [failed, setFailed] = useState(false);
  // Reset saat link berganti (pola setState-saat-render, sama dgn Thumbnail TikTok).
  const [prevLink, setPrevLink] = useState(link);
  if (link !== prevLink) {
    setPrevLink(link);
    setFailed(false);
  }

  // Tile fallback: gradasi lembut khas IG + ikon jenis konten — tampil disengaja,
  // bukan "gambar rusak".
  const tile = (
    <div
      style={{
        width, height, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: Math.round(width / 2.6),
        background: "linear-gradient(135deg, rgba(228,64,95,.14), rgba(247,119,55,.14), rgba(188,24,136,.14))",
        border: "1px solid rgba(0,60,68,.08)",
      }}
      title={postType || "Instagram"}
    >
      {iconFor(postType)}
    </div>
  );

  const inner = !src || failed ? tile : (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="thumbnail"
      loading="lazy"
      width={width}
      height={height}
      onError={() => setFailed(true)}
      style={{ width, height, objectFit: "cover", borderRadius: 8, background: "rgba(0,60,68,.08)", display: "block" }}
    />
  );

  if (!link) return tile;
  return (
    <a href={link} target="_blank" rel="noopener noreferrer" title="Buka di Instagram" className="inline-block transition-transform hover:scale-105">
      {inner}
    </a>
  );
}
