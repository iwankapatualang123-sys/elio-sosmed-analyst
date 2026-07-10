// File: lib/tiktok/content-plan.js
// Status otomatis untuk Rencana Konten (Content Plan). Meniru rumus Excel
//   =IF(COUNTIF('Sosmed Report'!D:D, Hook)>0,"Uploaded","Work in Progress")
// tapi di aplikasi tidak ada kolom "Sosmed Report Hook" — buktinya adalah konten
// yang SUDAH tayang di tabel tiktok_content. Jadi status dihitung dengan mencocokkan
// Headline/Hook rencana ke judul (video_title) / link konten tayang.
//
// Pencocokan sengaja "toleran": judul TikTok asli (caption) jarang identik dengan
// hook rencana, jadi dipakai kemiripan kata (Dice coefficient) + kecocokan link.
// Hasilnya transparan: kembalikan judul konten yang cocok supaya user bisa cek.
//
// Modul ESM (dipakai Server Component & node test via require(esm), Node >= 22).

// Kata platform/bulan yang bukan inti pesan — dibuang agar tidak mengganggu skor.
const NOISE = /\b(ig|instagram|tiktok|tik tok|reels?|reel|feed|story|stories|carousel|video|part|konten|content|footage|januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b/gi;

// Fungsi: normalizeText
// Bikin teks jadi kanonik untuk dibandingkan: huruf kecil, buang tanda kutip/baca &
// kata "noise", rapikan spasi. Input: string. Output: string.
export function normalizeText(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[‘’“”"'`]/g, " ")
    .replace(NOISE, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Fungsi: tokenSet — himpunan kata bermakna (>= 3 huruf) dari sebuah teks.
function tokenSet(s) {
  return new Set(normalizeText(s).split(" ").filter((w) => w.length >= 3));
}

// Fungsi: similarity
// Kemiripan dua teks 0..1 memakai Dice coefficient pada himpunan kata.
// Input: dua string. Output: number 0..1.
export function similarity(a, b) {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter += 1;
  return (2 * inter) / (A.size + B.size);
}

// Normalisasi URL video untuk perbandingan link (buang protokol/www/query/slash).
function normLink(u) {
  const s = String(u ?? "").trim().toLowerCase();
  if (!s) return "";
  return s.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "").split("?")[0];
}

// Fungsi: extractVideoId
// Ambil ID video numerik TikTok dari sebuah URL (untuk pencocokan yang andal, sama
// seperti yang dipakai parser saat impor). Link pendek (vt.tiktok.com/...) tidak
// mengandung ID -> null (nanti fallback ke pencocokan string URL). Output: string|null.
export function extractVideoId(url) {
  const s = String(url ?? "");
  let m = s.match(/\/(?:video|photo)\/(\d{6,25})/);
  if (m) return m[1];
  m = s.match(/(?:item_id|aweme_id|video_id)=(\d{6,25})/i);
  if (m) return m[1];
  return null;
}

// Fungsi: matchPlanStatus
// Verifikasi status sebuah baris rencana. Sumber kebenaran = LINK konten tayang yang
// diinput tim (posted_url), dicocokkan dengan data report TikTok Studio (tiktok_content).
// - status_override diisi        -> pakai itu (koreksi manual).
// - posted_url cocok video report -> "Verified" (via video_id atau URL yang sama).
// - selain itu                   -> "Not verified".
// Kecocokan judul/hook TIDAK memverifikasi (judul TikTok tak selalu = hook); ia hanya
// jadi `hint` non-otoritatif untuk membantu tim menemukan link yang harus ditempel.
// Input: plan { headline, posted_url, status_override }, contents [{ video_id,
//        video_title, video_link, post_date }], options { threshold }.
// Output: { status, match|null, matchedBy, hint|null }.
export function matchPlanStatus(plan = {}, contents = [], options = {}) {
  const threshold = options.threshold ?? 0.6;

  const override = String(plan.status_override ?? "").trim();
  if (override) return { status: override, match: null, matchedBy: "override", hint: null };

  // 1) Verifikasi via link tayang (posted_url) vs data report.
  const posted = String(plan.posted_url ?? "").trim();
  if (posted) {
    const pid = extractVideoId(posted);
    const pnorm = normLink(posted);
    for (const c of contents) {
      const cid = c.video_id || extractVideoId(c.video_link);
      if (pid && cid && String(pid) === String(cid)) {
        return { status: "Verified", match: c, matchedBy: "video_id", hint: null };
      }
      if (pnorm && c.video_link && normLink(c.video_link) === pnorm) {
        return { status: "Verified", match: c, matchedBy: "url", hint: null };
      }
    }
  }

  // 2) Belum terverifikasi. Cari HINT teks (non-otoritatif): judul konten tayang yang
  //    mirip hook, pakai CONTAINMENT (kata hook yang muncul di judul) / ukuran terkecil.
  //    Penjaga: minimal 2 kata bermakna sama. Ini hanya saran untuk bantu tim.
  const hook = String(plan.headline ?? "").trim();
  let hint = null;
  if (hook) {
    const A = tokenSet(hook);
    let best = null;
    let bestScore = 0;
    for (const c of contents) {
      const B = tokenSet(c.video_title);
      if (A.size === 0 || B.size === 0) continue;
      let inter = 0;
      for (const w of A) if (B.has(w)) inter += 1;
      const score = inter / Math.min(A.size, B.size);
      if (inter >= Math.min(2, A.size) && score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (best && bestScore >= threshold) {
      hint = { video_title: best.video_title, video_link: best.video_link, score: Math.round(bestScore * 100) / 100 };
    }
  }
  return { status: "Not verified", match: null, matchedBy: null, hint };
}

// Fungsi: summarizePlans
// Ringkas daftar status untuk kartu KPI. Input: array status string.
// Output: { total, verified, notVerified }.
export function summarizePlans(statuses = []) {
  const out = { total: statuses.length, verified: 0, notVerified: 0 };
  for (const s of statuses) {
    if (s === "Verified") out.verified += 1;
    else out.notVerified += 1;
  }
  return out;
}

// Pilihan dropdown — disalin PERSIS dari Data Validation resmi di sheet Excel
// "Content Plan" (kolom E/H/I/J/K), bukan tebakan dari data yang terlihat.
export const PIC_OPTIONS = ["DHYAS", "ITA", "ENDIN"];
export const GOALS_OPTIONS = ["Awareness", "Engagement"];
export const PILLAR_OPTIONS = ["Awareness", "Entertaint", "Branding Person (Promotion)", "Product knowledge"];
export const TYPE_OPTIONS = ["Single Image", "Carousel", "Video"];
