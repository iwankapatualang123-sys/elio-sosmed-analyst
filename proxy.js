// File: proxy.js
// Next.js "proxy" (pengganti middleware sejak Next 16): proteksi rute berbasis
// sesi JWT cookie. Edge-safe (verifikasi pakai Web Crypto via lib/auth-edge —
// tanpa node:crypto/prisma/bcrypt). Penegakan is_active dilakukan di
// getCurrentProfile (server) yang mengembalikan null untuk akun nonaktif.

import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth-edge";

export async function proxy(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const payload = await verifySession(token);

  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/login");
  const isApi = path.startsWith("/api");

  if (!payload && !isAuthRoute && !isApi) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (payload && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Jalankan di semua rute KECUALI aset statis & gambar.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
