// File: app/api/tiktok-thumbnail/route.js
// Proxy thumbnail video TikTok via oEmbed (blueprint 25). Alur: url video ->
// https://www.tiktok.com/oembed -> thumbnail_url -> DIKECILKAN (sharp) -> balik.
// Diproxy server-side supaya tidak kena masalah CORS/hotlink/referer di browser.
//
// PENTING (perf): oEmbed mengembalikan gambar RESOLUSI PENUH (~600KB) padahal
// ditampilkan cuma ~52px. Tanpa dikecilkan, 1 halaman = belasan × 600KB lewat
// fungsi server -> lambat & gambar sering "gagal muat". Di sini di-resize ke ~200px
// (~10-20KB) + cache di CDN Vercel (s-maxage) supaya muat berikutnya instan.
// Butuh login (cegah dipakai jadi open image-proxy). Runtime Node.
// GET /api/tiktok-thumbnail?url=<url video tiktok>

import sharp from "sharp";
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
    const original = Buffer.from(await img.arrayBuffer());

    // Kecilkan ke lebar ~200px (cukup untuk thumbnail 52px @retina) -> ~10-20KB.
    // Kalau resize gagal (mis. format aneh), pakai gambar asli sebagai fallback.
    let body = original;
    let contentType = img.headers.get("content-type") || "image/jpeg";
    try {
      body = await sharp(original).resize({ width: 200, withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer();
      contentType = "image/jpeg";
    } catch {
      /* pakai `original` */
    }

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Browser cache 1 hari + CDN Vercel cache 7 hari (s-maxage) supaya request
        // berikutnya dilayani dari edge, tanpa memanggil oEmbed/fungsi lagi.
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    return new Response(`Gagal: ${err && err.message ? err.message : String(err)}`, { status: 500 });
  }
}
