// File: components/Thumbnail.jsx
// Thumbnail video TikTok (client). Karena oEmbed TikTok memblokir IP datacenter
// (Vercel), resolusi thumbnail_url dilakukan DI BROWSER (IP user tidak diblokir),
// lalu:
//   1) coba tampilkan versi KECIL lewat proxy server (/api/tiktok-thumbnail?img=…)
//      yang resize ~600KB→~13KB + cache CDN,
//   2) kalau proxy gagal → pakai URL CDN LANGSUNG (full-res, tetap tampil),
//   3) kalau tetap gagal → placeholder 🎬.
// Cache hasil oEmbed di memori (per sesi halaman) supaya tidak resolusi berulang.

"use client";

import { useEffect, useState } from "react";

const oembedCache = new Map(); // video_link -> thumbnail_url

async function resolveThumb(link) {
  if (oembedCache.has(link)) return oembedCache.get(link);
  const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(link)}`);
  if (!r.ok) throw new Error("oembed gagal");
  const j = await r.json();
  const url = j.thumbnail_url || null;
  oembedCache.set(link, url);
  return url;
}

export default function Thumbnail({ link, width = 48, height = 64 }) {
  const [thumb, setThumb] = useState(() => (link && oembedCache.has(link) ? oembedCache.get(link) : null));
  const [ready, setReady] = useState(() => !!link && oembedCache.has(link));
  // stage: proxy -> direct -> failed.
  const [stage, setStage] = useState("proxy");
  // Reset saat `link` berganti (pola resmi React: setState saat render, bukan di effect).
  const [prevLink, setPrevLink] = useState(link);
  if (link !== prevLink) {
    setPrevLink(link);
    setStage("proxy");
    setReady(!!link && oembedCache.has(link));
    setThumb(link && oembedCache.has(link) ? oembedCache.get(link) : null);
  }

  useEffect(() => {
    // Cache-hit & mount awal sudah ditangani inisialisasi useState + reset saat render.
    // Effect hanya perlu resolusi oEmbed async untuk link yang belum di-cache.
    let alive = true;
    if (!link || oembedCache.has(link)) return undefined;
    resolveThumb(link)
      .then((u) => { if (alive) { setThumb(u); setReady(true); } })
      .catch(() => { if (alive) { setThumb(null); setReady(true); } });
    return () => { alive = false; };
  }, [link]);

  const box = { width, height, borderRadius: 8, background: "rgba(0,60,68,.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(width / 3) };

  if (!link) return <div style={box}>🎬</div>;
  if (!ready) return <div style={box} aria-busy="true" />; // masih resolusi oEmbed
  if (!thumb || stage === "failed") return <div style={box}>🎬</div>;

  const src = stage === "proxy" ? `/api/tiktok-thumbnail?img=${encodeURIComponent(thumb)}` : thumb;
  const onError = () => setStage((s) => (s === "proxy" ? "direct" : "failed"));

  return (
    <a href={link} target="_blank" rel="noopener noreferrer" title="Buka di TikTok" className="inline-block transition-transform hover:scale-105">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="thumbnail"
        loading="lazy"
        width={width}
        height={height}
        onError={onError}
        style={{ width, height, objectFit: "cover", borderRadius: 8, background: "rgba(0,60,68,.08)", display: "block" }}
      />
    </a>
  );
}
