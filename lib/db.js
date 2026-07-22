// File: lib/db.js
// Prisma client tunggal (singleton) untuk seluruh app — pengganti client Supabase
// sisi server. Pola singleton mencegah ledakan koneksi saat hot-reload dev Next.js.
// Server-only: JANGAN import dari Client Component.

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__elioPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__elioPrisma = prisma;
}

export default prisma;
