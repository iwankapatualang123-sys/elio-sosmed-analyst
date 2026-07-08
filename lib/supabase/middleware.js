// File: lib/supabase/middleware.js
// Tujuan: refresh sesi auth Supabase di setiap request (via cookie) + proteksi rute.
// Dipanggil dari middleware.js root. User belum login diarahkan ke /login; rute
// /api tidak di-redirect (route handler-nya cek auth sendiri lalu balas 401).

import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Fungsi: updateSession
// Input: NextRequest. Output (async): NextResponse (lanjut / redirect).
export async function updateSession(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // PENTING: jangan sisipkan logika di antara createServerClient dan getUser().
  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/login");
  const isApi = path.startsWith("/api");

  if (!user && !isAuthRoute && !isApi) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/upload";
    return NextResponse.redirect(url);
  }
  return response;
}
