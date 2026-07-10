// File: app/api/insights/route.js
// Endpoint ringkasan naratif. Ambil metrik cabang -> insight formula -> (opsional)
// perkaya jadi kalimat natural via Groq bila GROQ_API_KEY tersedia. Blueprint bagian 18.
// Runtime Node. Auth via sesi user (RLS).

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { loadBranchDetail } from "@/lib/tiktok/analytics";
import { buildInsightPrompt } from "@/lib/tiktok/insights";
import { isGroqConfigured, groqChat } from "@/lib/ai/groq-client";

export const runtime = "nodejs";

export async function POST(request) {
  const profile = await getCurrentProfile();
  if (!profile?.role) return NextResponse.json({ error: "Belum login." }, { status: 401 });

  let body = {};
  try { body = await request.json(); } catch { /* biarkan kosong */ }
  const accountId = body.accountId;
  const namaCabang = body.namaCabang || "akun ini";
  const month = /^\d{4}-\d{2}$/.test(body.month) ? body.month : null;
  if (!accountId) return NextResponse.json({ error: "accountId wajib." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const detail = await loadBranchDetail(supabase, accountId, { month });
  if (!detail) return NextResponse.json({ error: "Cabang tidak ditemukan/tidak ada akses." }, { status: 403 });

  const insights = detail.insights || [];
  // Fallback naratif berbasis formula (selalu tersedia).
  const formulaNarrative = insights.map((i) => i.kesimpulan).join(" ");
  const periodLabel = month ? `bulan ${month}` : null;

  if (!isGroqConfigured()) {
    return NextResponse.json({ source: "formula", narrative: formulaNarrative, configured: false });
  }
  try {
    const narrative = await groqChat(buildInsightPrompt(namaCabang, insights, periodLabel));
    return NextResponse.json({ source: "ai", narrative: narrative || formulaNarrative, configured: true });
  } catch (err) {
    // Kalau AI gagal, tetap balas versi formula (jangan bikin fitur mati).
    return NextResponse.json({ source: "formula", narrative: formulaNarrative, configured: true, warning: String(err.message || err) });
  }
}
