// File: lib/access.js
// Pengganti RLS Supabase (can_access_account) — sekarang ditegakkan di kode.
// Aturan (disalin dari policy Postgres lama):
//   - admin            → akses SEMUA cabang, boleh kelola cabang & user.
//   - manager/staff    → hanya cabang yang ada di user_branch_access miliknya.
//   - tulis data       → admin atau manager (canWrite).
//   - content_plans / instagram_content: hapus = pembuat atau admin;
//     edit = pembuat, admin, atau manager.
// Server-only.

import prisma from "./db";

// Fungsi: canWrite — role boleh INSERT/UPDATE data (admin atau manager).
export function canWrite(profile) {
  return !!profile && (profile.role === "admin" || profile.role === "manager");
}

// Fungsi: isAdmin
export function isAdmin(profile) {
  return !!profile && profile.role === "admin";
}

// Fungsi: accessibleAccountIds
// Kembalikan daftar id cabang yang boleh diakses user. `null` berarti SEMUA
// (khusus admin) — pemanggil harus memperlakukan null = tanpa filter.
export async function accessibleAccountIds(profile) {
  if (!profile) return [];
  if (profile.role === "admin") return null; // semua
  const rows = await prisma.userBranchAccess.findMany({
    where: { userId: profile.id },
    select: { tiktokAccountId: true },
  });
  return rows.map((r) => r.tiktokAccountId);
}

// Fungsi: accountWhere
// Bentuk klausa `where` Prisma untuk memfilter berdasar cabang yang boleh diakses.
// Untuk admin → {} (tanpa batas). Field default "tiktokAccountId".
export async function accountWhere(profile, field = "tiktokAccountId") {
  const ids = await accessibleAccountIds(profile);
  if (ids === null) return {};
  return { [field]: { in: ids.length ? ids : ["__none__"] } };
}

// Fungsi: canAccessAccount — apakah user boleh mengakses satu cabang tertentu.
export async function canAccessAccount(profile, accountId) {
  if (!profile || !accountId) return false;
  if (profile.role === "admin") return true;
  const row = await prisma.userBranchAccess.findFirst({
    where: { userId: profile.id, tiktokAccountId: accountId },
    select: { id: true },
  });
  return !!row;
}

// Fungsi: assertCanAccess — lempar bila user tak boleh akses cabang.
export async function assertCanAccess(profile, accountId) {
  if (!(await canAccessAccount(profile, accountId))) {
    const e = new Error("Tidak punya akses ke cabang ini.");
    e.status = 403;
    throw e;
  }
}
