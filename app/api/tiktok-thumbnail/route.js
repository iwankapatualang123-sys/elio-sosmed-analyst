// File: app/api/tiktok-thumbnail/route.js
// Proxy thumbnail video TikTok via oEmbed (blueprint 25). Alur: url video ->
// https://www.tiktok.com/oembed -> thumbnail_url -> stream gambarnya balik.
// Diproxy server-side supaya tidak kena masalah CORS/hotlink/referer di browser,
// dan bisa di-cache. Butuh login (cegah dipakai jadi open image-proxy).
// Runtime Node. GET /api/tiktok-thumbnail?url=<url video tiktok>

import { getCurrentProfile } from "@/lib/auth";

export const runtime = "nodejs";

// Cache in-memory hasil oEmbed (url video -> thumbnail_url) supaya tidak memanggil
// oEmbed berulang. Reset saat server restart — cukup untuk kebutuhan ini.
const oembedCache = new Map();

export async function GET(request) {
  const profile = await getCurrentProfile();
  if (!profile?.role) return new Response("Unauthorized", { status: 401 });

  const videoUrl = new URL(request.url).searchParams.get("url");
  if (!videoUrl || !/^https?:\/\/([\w-]+\.)?tiktok\.com\//i.test(videoUrl)) {
    return new Response("URL TikTok tidak valid", { status: 400 });
  }

  try {
    let thumbUrl = oembedCache.get(videoUrl);
    if (!thumbUrl) {
      const oe = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (!oe.ok) return new Response("oEmbed gagal", { status: 502 });
      const data = await oe.json();
      thumbUrl = data.thumbnail_url;
      if (!thumbUrl) return new Response("Tidak ada thumbnail", { status: 404 });
      oembedCache.set(videoUrl, thumbUrl);
    }

    const img = await fetch(thumbUrl);
    if (!img.ok) return new Response("Gambar gagal diambil", { status: 502 });
    const buf = await img.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": img.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=86400", // cache 1 hari di browser
      },
    });
  } catch (err) {
    return new Response(`Gagal: ${err && err.message ? err.message : String(err)}`, { status: 500 });
  }
}
