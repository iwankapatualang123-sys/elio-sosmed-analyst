// File: scripts/resolve-plan-links.mjs
// Backfill SEKALI JALAN: resolusi semua link pendek TikTok (vt.tiktok.com/…) yang
// sudah terlanjur tersimpan di content_plans.posted_url menjadi URL lengkap
// (.../video/<id>), supaya verifikasi otomatis Rencana Konten bisa mencocokkannya
// ke data report. Aman diulang (idempotent): link yang sudah lengkap dilewati.
//
// Jalankan DI SERVER (butuh akses internet ke tiktok.com + DATABASE_URL):
//   node scripts/resolve-plan-links.mjs

import { PrismaClient } from "@prisma/client";
import { resolveTikTokLink } from "../lib/tiktok/resolve-link.js";

const prisma = new PrismaClient();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT id, posted_url FROM content_plans WHERE posted_url IS NOT NULL AND posted_url <> ''",
  );
  console.log(`Total rencana dengan link: ${rows.length}`);

  let resolved = 0, skipped = 0, failed = 0;
  for (const r of rows) {
    const before = String(r.posted_url);
    // Lewati yang sudah lengkap atau bukan link pendek tiktok.
    if (/tiktok\.com\/@[^/\s]+\/(?:video|photo)\/\d{6,25}/i.test(before) ||
        !/(?:vt|vm)\.tiktok\.com\//i.test(before)) {
      skipped += 1;
      continue;
    }
    const after = await resolveTikTokLink(before);
    if (after && after !== before && /\/(?:video|photo)\/\d{6,25}/i.test(after)) {
      await prisma.contentPlan.update({ where: { id: r.id }, data: { postedUrl: after } });
      resolved += 1;
      console.log(`  ✓ ${before.slice(0, 40)}…  →  …/video/${after.match(/\/(?:video|photo)\/(\d{6,25})/i)?.[1]}`);
    } else {
      failed += 1;
      console.log(`  ✗ gagal resolusi: ${before.slice(0, 60)}`);
    }
    await sleep(400); // jeda sopan biar tidak dibatasi TikTok
  }

  console.log(`\nSelesai — diresolusi: ${resolved}, dilewati (sudah lengkap/non-tiktok): ${skipped}, gagal: ${failed}`);
}

main()
  .catch((e) => { console.error("❌ Gagal:", e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
