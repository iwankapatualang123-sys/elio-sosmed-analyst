// File: proxy.js
// Next.js "proxy" (pengganti middleware sejak Next 16): jalankan refresh sesi +
// proteksi rute di tiap request. Detail logika ada di lib/supabase/middleware.js.

import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request) {
  return updateSession(request);
}

export const config = {
  // Jalankan di semua rute KECUALI aset statis & gambar.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
