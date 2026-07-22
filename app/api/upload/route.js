// File: app/api/upload/route.js
// Endpoint upload data TikTok. Menerima multipart/form-data (accountId + files),
// memverifikasi user (harus admin/manager), lalu menjalankan pipeline
// lib/tiktok/upload.js (bongkar arsip -> parse -> upsert). Balas ringkasan JSON.
//
// Runtime Node (butuh Buffer/exceljs/fflate — bukan edge). Auth & RLS lewat client
// Supabase yang terikat sesi user.

import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getCurrentProfile, canWrite } from "@/lib/auth";
import { canAccessAccount } from "@/lib/access";
import { makeSyncDbClient } from "@/lib/tiktok/db-client";
import { processUpload } from "@/lib/tiktok/upload.js";
import { logActivity } from "@/lib/audit";

export const runtime = "nodejs";

// Rate limit sederhana per user (in-memory, blueprint 21F): maks 20 upload / 60 detik.
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 20;
const rateHits = new Map();
function isRateLimited(userId) {
  const now = Date.now();
  const hits = (rateHits.get(userId) || []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  rateHits.set(userId, hits);
  return hits.length > RATE_MAX;
}

export async function POST(request) {
  // 1) Auth + role
  const profile = await getCurrentProfile();
  if (!profile?.id) {
    return NextResponse.json({ error: "Belum login." }, { status: 401 });
  }
  if (!canWrite(profile)) {
    return NextResponse.json({ error: "Hanya admin/manager yang boleh mengunggah data." }, { status: 403 });
  }
  if (isRateLimited(profile.id)) {
    return NextResponse.json({ error: "Terlalu banyak upload dalam waktu singkat. Coba lagi sebentar lagi." }, { status: 429 });
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

  // 3) Ambil data cabang (untuk deteksi salah-cabang); cek akses menggantikan RLS.
  if (!(await canAccessAccount(profile, String(accountId)))) {
    return NextResponse.json({ error: "Cabang tidak ditemukan atau Anda tidak punya akses." }, { status: 403 });
  }
  const accRow = await prisma.tiktokAccount.findUnique({
    where: { id: String(accountId) },
    select: { id: true, namaCabang: true, tiktokUsername: true },
  });
  if (!accRow) {
    return NextResponse.json({ error: "Cabang tidak ditemukan atau Anda tidak punya akses." }, { status: 403 });
  }
  // Bentuk snake_case sesuai yang diharapkan pipeline upload (lib/tiktok/upload.js).
  const account = { id: accRow.id, nama_cabang: accRow.namaCabang, tiktok_username: accRow.tiktokUsername };

  // 4) Ubah File -> { filename, buffer }
  const files = [];
  for (const f of fileEntries) {
    const buffer = Buffer.from(await f.arrayBuffer());
    files.push({ filename: f.name || "unknown", buffer });
  }

  // 5) Jalankan pipeline (bongkar -> parse -> upsert)
  try {
    const result = await processUpload(makeSyncDbClient(prisma), account, files, {});
    await logActivity({
      action: "upload_data",
      entity: account.nama_cabang,
      detail: { totals: result.totals, files: files.length },
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: `Gagal memproses upload: ${err && err.message ? err.message : String(err)}` },
      { status: 500 },
    );
  }
}
