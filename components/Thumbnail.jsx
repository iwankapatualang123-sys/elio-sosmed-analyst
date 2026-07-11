// File: components/Thumbnail.jsx
// Thumbnail video TikTok (client) — memuat gambar via proxy /api/tiktok-thumbnail
// yang sudah dikecilkan server-side. Kalau gagal (link dihapus dll), tampilkan
// placeholder 🎬 alih-alih ikon "gambar rusak". Bisa dipakai di Server Component
// (report page) karena komponen client boleh diimpor ke server component.

"use client";

import { useState } from "react";

export default function Thumbnail({ link, width = 48, height = 64 }) {
  const [failed, setFailed] = useState(false);
  const box = { width, height, borderRadius: 8, background: "rgba(0,60,68,.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(width / 3) };

  if (!link || failed) return <div style={box}>🎬</div>;

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/tiktok-thumbnail?url=${encodeURIComponent(link)}`}
      alt="thumbnail"
      loading="lazy"
      width={width}
      height={height}
      onError={() => setFailed(true)}
      style={{ width, height, objectFit: "cover", borderRadius: 8, background: "rgba(0,60,68,.08)", display: "block" }}
    />
  );
  return (
    <a href={link} target="_blank" rel="noopener noreferrer" title="Buka di TikTok" className="inline-block transition-transform hover:scale-105">{img}</a>
  );
}
