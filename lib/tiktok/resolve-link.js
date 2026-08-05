// File: lib/tiktok/resolve-link.js
// Resolusi link TikTok PENDEK (vt.tiktok.com / vm.tiktok.com) menjadi URL LENGKAP
// yang mengandung video_id (.../video/<angka>). Dipakai agar verifikasi otomatis
// Rencana Konten bisa mencocokkan link tayang ke data report (yang menyimpan URL
// lengkap). Link pendek dari fitur "Share" TikTok tidak memuat video_id, jadi
// harus di-resolusi lewat redirect (HEAD → header Location).
//
// Server-only (butuh fetch keluar ke tiktok.com). Tahan gagal: kalau jaringan
// error / bukan link pendek, kembalikan string asli tanpa melempar.

// URL sudah lengkap (punya /video/<id> atau /photo/<id>)?
const FULL_RE = /tiktok\.com\/@[^/\s]+\/(?:video|photo)\/(\d{6,25})/i;
// Link pendek tiktok di dalam string (bisa bercampur teks/URL lain, mis. link IG).
const SHORT_RE = /https?:\/\/(?:vt|vm)\.tiktok\.com\/[A-Za-z0-9._-]+\/?/i;

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";

// Fungsi: resolveTikTokLink
// Ubah link pendek jadi URL lengkap. Input: string (boleh mengandung link lain).
// Output (async): string dengan link pendek diganti URL lengkap; atau string asli
// kalau sudah lengkap / bukan link pendek / gagal resolusi.
export async function resolveTikTokLink(raw, { timeoutMs = 8000, maxHops = 5 } = {}) {
  const s = String(raw ?? "").trim();
  if (!s) return raw;
  if (FULL_RE.test(s)) return s;                 // sudah lengkap
  const m = s.match(SHORT_RE);
  if (!m) return raw;                            // tak ada link pendek tiktok
  const shortUrl = m[0];

  try {
    let current = shortUrl;
    for (let i = 0; i < maxHops; i += 1) {
      const res = await fetch(current, {
        method: "HEAD",
        redirect: "manual",
        headers: { "user-agent": UA },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const loc = res.headers.get("location");
      if (!loc) break;
      const next = new URL(loc, current).toString();
      if (FULL_RE.test(next)) {
        // Ganti HANYA bagian link pendek dgn URL lengkap; sisanya (mis. link IG)
        // tetap dipertahankan.
        return s.replace(shortUrl, next);
      }
      current = next;
      if (!/tiktok\.com/i.test(current)) break;  // ke luar tiktok → berhenti
    }
  } catch {
    // jaringan error / timeout → biarkan, kembalikan asli
  }
  return raw;
}

// Fungsi: extractVideoIdFromLink — ambil video_id dari URL lengkap (helper kecil).
export function extractVideoIdFromLink(url) {
  const m = String(url ?? "").match(FULL_RE);
  return m ? m[1] : null;
}

export default resolveTikTokLink;
