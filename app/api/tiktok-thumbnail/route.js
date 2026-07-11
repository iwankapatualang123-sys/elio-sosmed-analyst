// File: app/api/tiktok-thumbnail/route.js
// Proxy + pengecil thumbnail video TikTok. Blueprint 25.
//
// KENAPA HYBRID: oEmbed TikTok (tiktok.com/oembed) MEMBLOKIR IP datacenter (mis.
// Vercel) — dari server ia balas HTML halaman blokir, bukan JSON. Jadi resolusi
// oEmbed dilakukan DI SISI KLIEN (browser user, IP rumahan tidak diblokir; lihat
// components/Thumbnail.jsx). Server di sini cuma menerima URL gambar CDN yang sudah
// diresolusi (?img=<tiktokcdn url>) lalu MENGECILKAN-nya (sharp, ~600KB→~13KB) +
// cache CDN. Gambar CDN (tiktokcdn.com) tidak kena blokir bot seperti API oEmbed.
//
// Jalur lama ?url=<video> (resolusi oEmbed di server) DIPERTAHANKAN untuk lokal/
// fallback, tapi di produksi Vercel jalur ini gagal (diblokir) — makanya klien
// memakai ?img=. Butuh login (cegah open image-proxy). Runtime Node.

import sharp from "sharp";
import { getCurrentProfile } from "@/lib/auth";

export const runtime = "nodejs";

// Cache in-memory hasil oEmbed (jalur ?url=) — reset saat restart.
const oembedCache = new Map();

// Host CDN gambar TikTok yang boleh di-proxy (cegah dipakai proxy gambar sembarang).
const CDN_RE = /^https:\/\/[a-z0-9.-]+\.tiktokcdn(-[a-z]+)?\.com\//i;

async function resizeAndRespond(imgResp) {
  if (!imgResp.ok) return new Response("Gambar gagal diambil", { status: 502 });
  const original = Buffer.from(await imgResp.arrayBuffer());
  let body = original;
  let contentType = imgResp.headers.get("content-type") || "image/jpeg";
  try {
    body = await sharp(original).resize({ width: 200, withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer();
    contentType = "image/jpeg";
  } catch {
    /* pakai gambar asli kalau resize gagal */
  }
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      // Browser 1 hari + CDN Vercel 7 hari, jadi request berikutnya dari edge.
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
    },
  });
}

export async function GET(request) {
  const profile = await getCurrentProfile();
  if (!profile?.role) return new Response("Unauthorized", { status: 401 });

  const params = new URL(request.url).searchParams;
  const imgUrl = params.get("img");
  const videoUrl = params.get("url");

  try {
    // Jalur UTAMA (dipakai klien): gambar CDN sudah diresolusi -> tinggal kecilkan.
    if (imgUrl) {
      if (!CDN_RE.test(imgUrl)) return new Response("URL gambar tidak valid", { status: 400 });
      return await resizeAndRespond(await fetch(imgUrl));
    }

    // Jalur lama (lokal/fallback): resolusi via oEmbed di server (DIBLOKIR di Vercel).
    if (!videoUrl || !/^https?:\/\/([\w-]+\.)?tiktok\.com\//i.test(videoUrl)) {
      return new Response("Parameter img/url tidak valid", { status: 400 });
    }
    let thumbUrl = oembedCache.get(videoUrl);
    if (!thumbUrl) {
      const oe = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!oe.ok) return new Response("oEmbed gagal", { status: 502 });
      const data = await oe.json();
      thumbUrl = data.thumbnail_url;
      if (!thumbUrl) return new Response("Tidak ada thumbnail", { status: 404 });
      oembedCache.set(videoUrl, thumbUrl);
    }
    return await resizeAndRespond(await fetch(thumbUrl));
  } catch (err) {
    return new Response(`Gagal: ${err && err.message ? err.message : String(err)}`, { status: 500 });
  }
}
