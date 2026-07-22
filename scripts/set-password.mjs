// File: scripts/set-password.mjs
// Set / reset password seorang user (via Prisma + bcrypt). Berguna untuk:
//  - membuat admin pertama di server baru (kalau tidak migrasi password lama),
//  - reset darurat kalau admin terkunci.
// Kalau email belum ada, user dibuat sebagai admin aktif.
//
// Jalankan DI SERVER (butuh DATABASE_URL ter-set):
//   node scripts/set-password.mjs <email> <password> [role]
//   role opsional: admin (default untuk user baru) | manager | staff
//
// Contoh:
//   node scripts/set-password.mjs admin@elio.com 'PasswordKuat123'

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const [email, password, roleArg] = process.argv.slice(2);
if (!email || !password) {
  console.error("Pemakaian: node scripts/set-password.mjs <email> <password> [admin|manager|staff]");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password minimal 8 karakter.");
  process.exit(1);
}
const role = ["admin", "manager", "staff"].includes(roleArg) ? roleArg : null;

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await prisma.profile.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    await prisma.profile.update({
      where: { id: existing.id },
      data: { passwordHash, isActive: true, ...(role ? { role } : {}) },
    });
    console.log(`✓ Password diperbarui untuk ${email} (role: ${role || existing.role}).`);
  } else {
    await prisma.profile.create({
      data: { email: email.toLowerCase(), passwordHash, role: role || "admin", isActive: true },
    });
    console.log(`✓ User baru dibuat: ${email} (role: ${role || "admin"}).`);
  }
}

main()
  .catch((e) => {
    console.error("❌ Gagal:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
