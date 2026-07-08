// File: app/api/upload/route.js
// Endpoint upload data TikTok. Menerima multipart/form-data (accountId + files),
// memverifikasi user (harus admin/manager), lalu menjalankan pipeline
// lib/tiktok/upload.js (bongkar arsip -> parse -> upsert). Balas ringkasan JSON.
//
// Runtime Node (butuh Buffer/exceljs/fflate — bukan edge). Auth & RLS lewat client
// Supabase yang terikat sesi user.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile, canWrite } from "@/lib/auth";
import { processUpload } from "@/lib/tiktok/upload.js";

export const runtime = "nodejs";

export async function POST(request) {
  // 1) Auth + role
  const profile = await getCurrentProfile();
  if (!profile?.id) {
    return NextResponse.json({ error: "Belum login." }, { status: 401 });
  }
  if (!canWrite(profile)) {
    return NextResponse.json({ error: "Hanya admin/manager yang boleh mengunggah data." }, { status: 403 });
  }

  // 2) Baca form
  let form;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Format request tidak valid (bukan multipart form-data)." }, { status: 400 });
  }
  const accountId = form.get("accountId");
  if (!accountId) {
    return NextResponse.json({ error: "Cabang belum dipilih." }, { status: 400 });
  }
  const fileEntries = form.getAll("files").filter((f) => typeof f === "object" && f && typeof f.arrayBuffer === "function");
  if (fileEntries.length === 0) {
    return NextResponse.json({ error: "Tidak ada file yang diunggah." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  // 3) Ambil data cabang (untuk deteksi salah-cabang); RLS memastikan user berhak.
  const { data: account, error: accErr } = await supabase
    .from("tiktok_accounts")
    .select("id, nama_cabang, tiktok_username")
    .eq("id", accountId)
    .maybeSingle();
  if (accErr || !account) {
    return NextResponse.json({ error: "Cabang tidak ditemukan atau Anda tidak punya akses." }, { status: 403 });
  }

  // 4) Ubah File -> { filename, buffer }
  const files = [];
  for (const f of fileEntries) {
    const buffer = Buffer.from(await f.arrayBuffer());
    files.push({ filename: f.name || "unknown", buffer });
  }

  // 5) Jalankan pipeline (bongkar -> parse -> upsert)
  try {
    const result = await processUpload(supabase, account, files, {});
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: `Gagal memproses upload: ${err && err.message ? err.message : String(err)}` },
      { status: 500 },
    );
  }
}
