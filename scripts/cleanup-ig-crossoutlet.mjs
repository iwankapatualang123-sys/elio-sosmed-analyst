// File: scripts/cleanup-ig-crossoutlet.mjs
// Membersihkan konten Instagram yang NYASAR ke outlet lain. Penyebab: ekspor Meta
// kadang memuat postingan dari beberapa akun, dan aplikasi menyimpan semuanya ke
// outlet yang dipilih. Script ini menghapus HANYA postingan yang username-nya =
// akun RESMI OUTLET LAIN (mis. "goliohub" yang masuk ke Elio). Postingan
// kreator/kolaborasi (username yang bukan akun outlet mana pun) DIBIARKAN.
//
// "Akun resmi outlet" = username IG yang PALING SERING muncul pada konten outlet itu.
//
// Pakai:
//   node scripts/cleanup-ig-crossoutlet.mjs           → DRY-RUN (hanya menampilkan)
//   node scripts/cleanup-ig-crossoutlet.mjs --delete  → benar-benar menghapus

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DO_DELETE = process.argv.includes("--delete");

const rows = await prisma.instagramContent.findMany({
  select: { id: true, tiktokAccountId: true, username: true, account: { select: { namaCabang: true } } },
});

// Username RESMI tiap outlet = modus (paling sering) di konten outlet tsb.
const perOutlet = new Map(); // accId -> { nama, counts: {username: n} }
for (const r of rows) {
  const u = (r.username || "").toLowerCase().trim();
  if (!u) continue;
  if (!perOutlet.has(r.tiktokAccountId)) perOutlet.set(r.tiktokAccountId, { nama: r.account?.namaCabang || "?", counts: {} });
  const o = perOutlet.get(r.tiktokAccountId);
  o.counts[u] = (o.counts[u] || 0) + 1;
}
const ownUsername = new Map(); // accId -> username resmi
for (const [accId, o] of perOutlet) {
  const top = Object.entries(o.counts).sort((a, b) => b[1] - a[1])[0];
  ownUsername.set(accId, top ? top[0] : null);
}
const outletUsernames = new Set([...ownUsername.values()].filter(Boolean)); // semua akun outlet

// Korban = postingan yang username-nya = akun outlet LAIN (ada di outletUsernames
// tapi ≠ akun resmi outlet tempat ia tersimpan).
const victims = rows.filter((r) => {
  const u = (r.username || "").toLowerCase().trim();
  return u && outletUsernames.has(u) && u !== ownUsername.get(r.tiktokAccountId);
});

const report = {};
for (const v of victims) {
  const k = `${v.account?.namaCabang || "?"}  ⟵  @${(v.username || "").toLowerCase()}`;
  report[k] = (report[k] || 0) + 1;
}
console.log("Username resmi per outlet:", Object.fromEntries([...perOutlet].map(([id, o]) => [o.nama, ownUsername.get(id)])));
console.log("\nKandidat hapus (konten milik outlet lain yang nyasar):");
console.log(report);
console.log("Total kandidat:", victims.length);

if (DO_DELETE && victims.length) {
  const res = await prisma.instagramContent.deleteMany({ where: { id: { in: victims.map((v) => v.id) } } });
  console.log(`\n✅ DIHAPUS ${res.count} postingan.`);
} else if (victims.length) {
  console.log("\nIni DRY-RUN — belum ada yang dihapus. Jalankan lagi dengan --delete untuk menghapus.");
} else {
  console.log("\nTidak ada konten nyasar. Bersih ✓");
}
await prisma.$disconnect();
