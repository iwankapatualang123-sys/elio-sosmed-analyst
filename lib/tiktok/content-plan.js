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

// 5 status siklus produksi konten (dipakai UI & KPI). Urutan = alur normal.
export const PLAN_STATUS = {
  ONGOING: "On Going",
  UPLOADED: "Uploaded",
  VERIFIED: "Verified",
  CANCELLED: "Cancelled",
  REPLACED: "Replaced",
};

// Platform tempat 1 rencana konten bisa tayang. TikTok satu-satunya yang bisa
// diverifikasi otomatis (kita punya data report-nya); Instagram/Threads berbasis
// link saja (Uploaded bila link diisi) sampai ada sumber data resminya.
export const PLATFORM_OPTIONS = [
  { key: "tiktok", label: "TikTok", short: "TT" },
  { key: "instagram", label: "Instagram", short: "IG" },
  { key: "threads", label: "Threads", short: "TH" },
];
export const PLATFORM_KEYS = PLATFORM_OPTIONS.map((p) => p.key);

// Fungsi: planPlatforms — platform target sebuah rencana (kolom text[] `platforms`).
// Data lama (null/kosong) dianggap TikTok saja supaya perilaku tidak berubah.
export function planPlatforms(plan) {
  const arr = Array.isArray(plan?.platforms) ? plan.platforms.filter((p) => PLATFORM_KEYS.includes(p)) : [];
  return arr.length ? arr : ["tiktok"];
}

// Fungsi: platformLink — link tayang sebuah platform. TikTok tetap di kolom lama
// `posted_url` (dipakai verifikasi & import); IG/Threads di jsonb `platform_links`.
export function platformLink(plan, platform) {
  if (platform === "tiktok") return String(plan?.posted_url ?? "").trim();
  const links = plan?.platform_links && typeof plan.platform_links === "object" ? plan.platform_links : {};
  return String(links[platform] ?? "").trim();
}
// Nilai status_override yang boleh dipakai untuk koreksi manual (menang atas otomatis).
const OVERRIDE_SET = new Set(Object.values(PLAN_STATUS));

// Bulan rencana ('YYYY-MM') dari plan_month (selalu ada) atau post_date.
function planMonthOf(plan) {
  const pm = String(plan.plan_month ?? "").slice(0, 7);
  if (/^\d{4}-\d{2}$/.test(pm)) return pm;
  const pd = String(plan.post_date ?? "").slice(0, 7);
  return /^\d{4}-\d{2}$/.test(pd) ? pd : null;
}

// HINT teks (non-otoritatif): judul konten tayang yang mirip hook (containment kata,
// minimal 2 kata sama, skor >= threshold). Hanya saran agar tim menemukan link.
function computeHint(plan, contents, threshold) {
  const hook = String(plan.headline ?? "").trim();
  if (!hook) return null;
  const A = tokenSet(hook);
  let best = null;
  let bestScore = 0;
  for (const c of contents) {
    const B = tokenSet(c.video_title);
    if (A.size === 0 || B.size === 0) continue;
    let inter = 0;
    for (const w of A) if (B.has(w)) inter += 1;
    const score = inter / Math.min(A.size, B.size);
    if (inter >= Math.min(2, A.size) && score > bestScore) { bestScore = score; best = c; }
  }
  if (best && bestScore >= threshold) {
    return { video_title: best.video_title, video_link: best.video_link, score: Math.round(bestScore * 100) / 100 };
  }
  return null;
}

// Fungsi: matchPlanStatus — tentukan 1 dari 5 status sebuah rencana.
// Prioritas:
//   1. Replaced   : ada tautan replaced_by_id (atau override 'Replaced').
//   2. Override    : status_override manual lain (On Going/Uploaded/Verified/Cancelled) menang.
//   3. Verified    : posted_url cocok data report TikTok (via video_id / URL).
//   4. Uploaded    : posted_url ada tapi belum cocok laporan.
//   5. Cancelled   : tanpa link & bulan rencana SUDAH lewat (options.currentMonth) → otomatis.
//   6. On Going     : selain di atas (masih berjalan).
// Input: plan { headline, posted_url, status_override, plan_month, post_date, replaced_by_id },
//        contents [{ video_id, video_title, video_link }], options { threshold, currentMonth }.
// Output: { status, match|null, matchedBy, hint|null }.
export function matchPlanStatus(plan = {}, contents = [], options = {}) {
  const threshold = options.threshold ?? 0.6;
  const currentMonth = options.currentMonth || null; // 'YYYY-MM' (hari ini)
  const override = String(plan.status_override ?? "").trim();

  // 1) Replaced ditentukan oleh TAUTAN pengganti (atau override eksplisit).
  if (plan.replaced_by_id || override === PLAN_STATUS.REPLACED) {
    return { status: PLAN_STATUS.REPLACED, match: null, matchedBy: "replaced", hint: null };
  }
  // 2) Override manual lain menang atas perhitungan otomatis.
  if (OVERRIDE_SET.has(override)) {
    return { status: override, match: null, matchedBy: "override", hint: null };
  }

  // 3) Verifikasi via link tayang (posted_url) vs data report.
  const posted = String(plan.posted_url ?? "").trim();
  if (posted) {
    const pid = extractVideoId(posted);
    const pnorm = normLink(posted);
    for (const c of contents) {
      const cid = c.video_id || extractVideoId(c.video_link);
      if (pid && cid && String(pid) === String(cid)) return { status: PLAN_STATUS.VERIFIED, match: c, matchedBy: "video_id", hint: null };
      if (pnorm && c.video_link && normLink(c.video_link) === pnorm) return { status: PLAN_STATUS.VERIFIED, match: c, matchedBy: "url", hint: null };
    }
    // 4) Ada link tapi belum cocok laporan -> Uploaded (hint bantu cari kecocokan).
    return { status: PLAN_STATUS.UPLOADED, match: null, matchedBy: null, hint: computeHint(plan, contents, threshold) };
  }

  // 5) Tanpa link: kalau bulan rencana sudah lewat -> Cancelled otomatis.
  const pm = planMonthOf(plan);
  if (currentMonth && pm && pm < currentMonth) {
    return { status: PLAN_STATUS.CANCELLED, match: null, matchedBy: "auto-bulan-lewat", hint: null };
  }
  // 6) Masih berjalan.
  return { status: PLAN_STATUS.ONGOING, match: null, matchedBy: null, hint: computeHint(plan, contents, threshold) };
}

// Fungsi: matchPlanStatusMulti — status per PLATFORM + status keseluruhan.
// TikTok dihitung penuh lewat matchPlanStatus (verifikasi vs data report).
// Instagram/Threads tidak punya data report -> berbasis link:
//   ada link -> Uploaded; tanpa link & bulan lewat -> Cancelled; selain itu On Going.
// Status keseluruhan = capaian TERBAIK antar platform (Verified > Uploaded >
// On Going > Cancelled) — konten yang tayang di salah satu platform tidak boleh
// tampak "batal" hanya karena platform lain belum diisi.
// Replaced/override manual berlaku untuk seluruh rencana (semua platform).
// Output: { status, match, matchedBy, hint, platforms, perPlatform: {key: {status,...}} }.
const STATUS_RANK = {
  [PLAN_STATUS.VERIFIED]: 4,
  [PLAN_STATUS.UPLOADED]: 3,
  [PLAN_STATUS.ONGOING]: 2,
  [PLAN_STATUS.CANCELLED]: 1,
};
export function matchPlanStatusMulti(plan = {}, contents = [], options = {}) {
  const platforms = planPlatforms(plan);

  // Replaced / override manual -> berlaku ke semua platform, selesai.
  const overall = matchPlanStatus(plan, contents, options);
  if (overall.matchedBy === "replaced" || overall.matchedBy === "override") {
    const perPlatform = Object.fromEntries(platforms.map((p) => [p, { status: overall.status, match: null, matchedBy: overall.matchedBy, hint: null }]));
    return { ...overall, platforms, perPlatform };
  }

  const currentMonth = options.currentMonth || null;
  const pm = planMonthOf(plan);
  const monthPassed = !!(currentMonth && pm && pm < currentMonth);

  const perPlatform = {};
  for (const p of platforms) {
    if (p === "tiktok") {
      // `overall` di atas SUDAH hasil logika TikTok (tanpa replaced/override).
      perPlatform[p] = { status: overall.status, match: overall.match, matchedBy: overall.matchedBy, hint: overall.hint };
    } else {
      const link = platformLink(plan, p);
      if (link) perPlatform[p] = { status: PLAN_STATUS.UPLOADED, match: null, matchedBy: "link", hint: null };
      else if (monthPassed) perPlatform[p] = { status: PLAN_STATUS.CANCELLED, match: null, matchedBy: "auto-bulan-lewat", hint: null };
      else perPlatform[p] = { status: PLAN_STATUS.ONGOING, match: null, matchedBy: null, hint: null };
    }
  }

  let best = null;
  for (const p of platforms) {
    const s = perPlatform[p];
    if (!best || (STATUS_RANK[s.status] || 0) > (STATUS_RANK[best.status] || 0)) best = s;
  }
  return {
    status: best.status,
    match: best.match || null,
    matchedBy: best.matchedBy || null,
    hint: perPlatform.tiktok?.hint || null,
    platforms,
    perPlatform,
  };
}

// Fungsi: summarizePlans — ringkas daftar status untuk kartu KPI.
// Input: array status string. Output: { total, onGoing, uploaded, verified, cancelled, replaced }.
export function summarizePlans(statuses = []) {
  const out = { total: statuses.length, onGoing: 0, uploaded: 0, verified: 0, cancelled: 0, replaced: 0 };
  for (const s of statuses) {
    if (s === PLAN_STATUS.ONGOING) out.onGoing += 1;
    else if (s === PLAN_STATUS.UPLOADED) out.uploaded += 1;
    else if (s === PLAN_STATUS.VERIFIED) out.verified += 1;
    else if (s === PLAN_STATUS.CANCELLED) out.cancelled += 1;
    else if (s === PLAN_STATUS.REPLACED) out.replaced += 1;
  }
  return out;
}

// Pilihan dropdown — disalin PERSIS dari Data Validation resmi di sheet Excel
// "Content Plan" (kolom E/H/I/J/K), bukan tebakan dari data yang terlihat.
export const PIC_OPTIONS = ["DHYAS", "ITA", "ENDIN"];
export const GOALS_OPTIONS = ["Awareness", "Engagement"];
export const PILLAR_OPTIONS = ["Awareness", "Entertaint", "Branding Person (Promotion)", "Product knowledge"];
export const TYPE_OPTIONS = ["Single Image", "Carousel", "Video"];
