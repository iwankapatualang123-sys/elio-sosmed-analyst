// File: lib/audit.js
// Helper pencatatan audit trail. Menyisipkan baris ke activity_log via Prisma.
// Aktor (user_id/email) diambil dari sesi login saat itu. Kegagalan log TIDAK
// boleh menggagalkan aksi utama. Server-only.

import prisma from "./db.js";
import { getSessionPayload } from "./auth.js";

// Fungsi: logActivity
// Input: { action, entity?, detail? }. Output (async): void.
// (Kompat mundur: bila dipanggil logActivity(x, opts) dengan arg pertama bukan
// opts — mis. sisa arg `supabase` lama — arg pertama diabaikan.)
export async function logActivity(arg1, arg2) {
  const opts = arg1 && arg1.action ? arg1 : arg2 || {};
  const { action, entity = null, detail = null } = opts;
  if (!action) return;
  try {
    const payload = await getSessionPayload();
    if (!payload?.sub) return;
    await prisma.activityLog.create({
      data: {
        userId: payload.sub,
        userEmail: payload.email || null,
        action,
        entity,
        detail: detail ?? undefined,
      },
    });
  } catch {
    // Diamkan — audit gagal tidak boleh mengganggu alur utama.
  }
}
