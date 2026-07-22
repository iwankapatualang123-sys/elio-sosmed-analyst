// File: app/api/auth/change-password/route.js
// Ganti password sendiri berdasarkan sesi login aktif (tanpa perlu password lama,
// meniru supabase.auth.updateUser). Simpan hash baru (bcrypt). Runtime Node.

import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { hashPassword } from "@/lib/auth-jwt";

export const runtime = "nodejs";

export async function POST(request) {
  const payload = await getSessionPayload();
  if (!payload?.sub) {
    return NextResponse.json({ error: "Belum login." }, { status: 401 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const newPassword = String(body.newPassword || "");
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "Password baru minimal 8 karakter." }, { status: 400 });
  }

  const user = await prisma.profile.findUnique({ where: { id: payload.sub }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
  }
  await prisma.profile.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
  return NextResponse.json({ ok: true });
}
