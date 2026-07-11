// File: test/tiktok-content-plan.test.js
// Tes status verifikasi Rencana Konten (lib/tiktok/content-plan.js). Jalankan: npm run test:content-plan

const {
  normalizeText, similarity, extractVideoId, matchPlanStatus, summarizePlans,
  matchPlanStatusMulti, planPlatforms, platformLink,
} = require("../lib/tiktok/content-plan.js");

let pass = 0;
let fail = 0;
function ok(name, cond) { if (cond) { pass += 1; console.log(`  ok  ${name}`); } else { fail += 1; console.log(`FAIL  ${name}`); } }

// --- normalizeText ---
ok("normalize buang kutip & platform", normalizeText('"Family Cafe" IG TIKTOK') === "family cafe");
ok("normalize buang tanda baca", normalizeText("POV: orang, Malang!") === "pov orang malang");
ok("normalize null aman", normalizeText(null) === "");

// --- similarity ---
ok("similarity identik = 1", similarity("family cafe elio", "Family Cafe Elio") === 1);
ok("similarity beda total = 0", similarity("family cafe", "barista joget") === 0);

// --- extractVideoId ---
ok("extract dari /video/", extractVideoId("https://www.tiktok.com/@elio/video/7412345678901234567") === "7412345678901234567");
ok("extract dari param item_id", extractVideoId("https://m.tiktok.com/v/123456789012.html?item_id=987654321098") === "987654321098");
ok("extract link pendek -> null", extractVideoId("https://vt.tiktok.com/ZSuQFss6F/") === null);

// --- matchPlanStatus: verifikasi berbasis URL ---
const contents = [
  { video_id: "7412345678901234567", video_title: "Family Cafe Elio suasana nyaman", video_link: "https://www.tiktok.com/@elio/video/7412345678901234567", post_date: "2026-04-14" },
  { video_id: "222", video_title: "Barista Elio bikin latte art", video_link: "https://www.tiktok.com/@elio/video/222", post_date: "2026-04-21" },
];

// Bulan berjalan (untuk uji Cancelled otomatis). Rencana bulan ini/masa depan = On Going.
const NOW = "2026-07";

// tanpa link & bulan ini -> On Going (belum lewat).
ok("tanpa link, bulan ini -> On Going", matchPlanStatus({ headline: '"Family Cafe" IG', plan_month: "2026-07-01" }, contents, { currentMonth: NOW }).status === "On Going");

const v1 = matchPlanStatus({ headline: "apa saja", posted_url: "https://www.tiktok.com/@elio/video/7412345678901234567" }, contents);
ok("posted_url cocok video_id -> Verified", v1.status === "Verified" && v1.matchedBy === "video_id");
ok("Verified sertakan match transparan", v1.match && v1.match.video_link.endsWith("/7412345678901234567"));

const v2 = matchPlanStatus({ headline: "x", posted_url: "http://www.tiktok.com/@elio/video/222/" }, contents);
ok("posted_url beda format tetap cocok -> Verified", v2.status === "Verified");

// posted_url ada tapi tak cocok laporan -> Uploaded (bukan Verified).
const v3 = matchPlanStatus({ headline: "x", posted_url: "https://www.tiktok.com/@elio/video/999999" }, contents);
ok("posted_url tak ada di report -> Uploaded", v3.status === "Uploaded");

// --- Cancelled otomatis: bulan lewat & tanpa link ---
ok("bulan lewat & tanpa link -> Cancelled", matchPlanStatus({ headline: "x", plan_month: "2026-06-01" }, contents, { currentMonth: NOW }).status === "Cancelled");
ok("bulan lewat TAPI ada link cocok -> Verified (link menang)", matchPlanStatus({ headline: "x", plan_month: "2026-06-01", posted_url: "https://www.tiktok.com/@elio/video/222" }, contents, { currentMonth: NOW }).status === "Verified");
ok("bulan lewat tanpa currentMonth -> tetap On Going (tak bisa hitung)", matchPlanStatus({ headline: "x", plan_month: "2026-06-01" }, contents).status === "On Going");

// --- Replaced: via tautan replaced_by_id atau override ---
ok("replaced_by_id -> Replaced", matchPlanStatus({ headline: "x", replaced_by_id: 99, plan_month: "2026-06-01" }, contents, { currentMonth: NOW }).status === "Replaced");
ok("override Replaced -> Replaced", matchPlanStatus({ headline: "x", status_override: "Replaced" }, []).status === "Replaced");

// --- hint teks (non-otoritatif) muncul di On Going/Uploaded ---
const h = matchPlanStatus({ headline: '"Family Cafe" IG TIKTOK', plan_month: "2026-07-01" }, contents, { currentMonth: NOW });
ok("hint muncul saat hook mirip judul (On Going)", h.status === "On Going" && h.hint && /Family Cafe/i.test(h.hint.video_title));

// --- override manual menang atas otomatis ---
ok("override Verified menang", matchPlanStatus({ headline: "x", status_override: "Verified" }, []).status === "Verified");
ok("override On Going menang atas Cancelled otomatis", matchPlanStatus({ headline: "x", plan_month: "2026-06-01", status_override: "On Going" }, [], { currentMonth: NOW }).status === "On Going");

// --- multi-platform: planPlatforms & platformLink ---
ok("planPlatforms data lama (tanpa kolom) -> ['tiktok']", JSON.stringify(planPlatforms({})) === '["tiktok"]');
ok("planPlatforms buang nilai asing", JSON.stringify(planPlatforms({ platforms: ["instagram", "facebook"] })) === '["instagram"]');
ok("platformLink tiktok pakai posted_url", platformLink({ posted_url: "https://t.tk/a" }, "tiktok") === "https://t.tk/a");
ok("platformLink instagram pakai platform_links", platformLink({ platform_links: { instagram: "https://ig/x" } }, "instagram") === "https://ig/x");
ok("platformLink kosong aman", platformLink({}, "threads") === "");

// --- matchPlanStatusMulti ---
// Data lama (TikTok saja) -> identik dgn matchPlanStatus.
const m0 = matchPlanStatusMulti({ headline: "x", posted_url: "https://www.tiktok.com/@elio/video/222" }, contents, { currentMonth: NOW });
ok("multi: TikTok-saja tetap Verified", m0.status === "Verified" && m0.perPlatform.tiktok.status === "Verified" && m0.platforms.length === 1);

// IG-only: ada link -> Uploaded (tidak bisa Verified, tak ada data report IG).
const m1 = matchPlanStatusMulti({ headline: "x", platforms: ["instagram"], platform_links: { instagram: "https://instagram.com/p/abc" }, plan_month: "2026-06-01" }, contents, { currentMonth: NOW });
ok("multi: IG ada link -> Uploaded", m1.status === "Uploaded" && m1.perPlatform.instagram.status === "Uploaded");

// TikTok+IG: TikTok verified, IG tanpa link bulan lewat -> overall tetap Verified.
const m2 = matchPlanStatusMulti(
  { headline: "x", platforms: ["tiktok", "instagram"], posted_url: "https://www.tiktok.com/@elio/video/222", plan_month: "2026-06-01" },
  contents, { currentMonth: NOW });
ok("multi: TT Verified + IG kosong -> overall Verified", m2.status === "Verified" && m2.perPlatform.instagram.status === "Cancelled");

// TikTok tanpa link (bulan lewat) TAPI IG ada link -> overall Uploaded (bukan Cancelled).
const m3 = matchPlanStatusMulti(
  { headline: "x", platforms: ["tiktok", "instagram"], platform_links: { instagram: "https://instagram.com/p/abc" }, plan_month: "2026-06-01" },
  contents, { currentMonth: NOW });
ok("multi: TT kosong + IG link -> overall Uploaded", m3.status === "Uploaded" && m3.perPlatform.tiktok.status === "Cancelled");

// Semua platform tanpa link & bulan lewat -> Cancelled.
const m4 = matchPlanStatusMulti({ headline: "x", platforms: ["tiktok", "threads"], plan_month: "2026-06-01" }, contents, { currentMonth: NOW });
ok("multi: semua kosong bulan lewat -> Cancelled", m4.status === "Cancelled" && m4.perPlatform.threads.status === "Cancelled");

// Replaced/override berlaku ke SEMUA platform.
const m5 = matchPlanStatusMulti({ headline: "x", platforms: ["tiktok", "instagram"], replaced_by_id: 9 }, contents, { currentMonth: NOW });
ok("multi: Replaced berlaku semua platform", m5.status === "Replaced" && m5.perPlatform.instagram.status === "Replaced");
const m6 = matchPlanStatusMulti({ headline: "x", platforms: ["instagram"], status_override: "Verified" }, [], { currentMonth: NOW });
ok("multi: override menang di semua platform", m6.status === "Verified" && m6.perPlatform.instagram.status === "Verified");

// --- summarizePlans (5 status) ---
const sum = summarizePlans(["Verified", "Verified", "On Going", "Uploaded", "Cancelled", "Replaced"]);
ok("summarize hitung 5 status", sum.total === 6 && sum.verified === 2 && sum.onGoing === 1 && sum.uploaded === 1 && sum.cancelled === 1 && sum.replaced === 1);

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
