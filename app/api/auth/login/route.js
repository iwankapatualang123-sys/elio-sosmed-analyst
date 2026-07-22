// File: app/api/auth/login/route.js
// Login: verifikasi email+password (bcrypt) lalu set cookie sesi JWT.
// Pengganti supabase.auth.signInWithPassword. Runtime Node (butuh bcrypt/prisma).

import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyPassword } from "@/lib/auth-jwt";
import { signSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth-edge";

export const runtime = "nodejs";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password) {
    return NextResponse.json({ error: "Email & password wajib diisi." }, { status: 400 });
  }

  const user = await prisma.profile.findUnique({ where: { email } });
  // Bandingkan password walau user tak ada? findUnique cepat; balas generik.
  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Email atau password salah." }, { status: 401 });
  }
  if (user.isActive === false) {
    return NextResponse.json({ error: "Akun Anda dinonaktifkan. Hubungi admin." }, { status: 403 });
  }

  const token = await signSession({ sub: user.id, email: user.email, role: user.role });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
