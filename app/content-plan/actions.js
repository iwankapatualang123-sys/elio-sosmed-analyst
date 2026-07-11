// File: app/content-plan/actions.js
// Server Actions untuk Rencana Konten (Content Plan). CRUD baris rencana per cabang.
// RLS (can_access_account + owner/admin) yang menjaga otorisasi; di sini fokus validasi
// ringan + revalidate. Status Uploaded/WIP dihitung saat baca (lib/tiktok/content-plan).

"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { PLATFORM_KEYS } from "@/lib/tiktok/content-plan";

// Ambil string rapi dari FormData; kosong -> null.
function str(formData, key) {
  const v = String(formData.get(key) ?? "").trim();
  return v === "" ? null : v;
}
// Tanggal 'YYYY-MM-DD' valid, selain itu null.
function dateOrNull(v) {
  const s = String(v ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
// Awal bulan ('YYYY-MM-01') dari sebuah tanggal, untuk kolom plan_month (grouping).
function monthFirstDay(dateStr) {
  const d = dateOrNull(dateStr);
  return d ? `${d.slice(0, 7)}-01` : null;
}
function toIntOrNull(v) {
  const s = String(v ?? "").replace(/[^\d]/g, "");
  if (s === "") return null;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

// Kumpulkan field baris dari FormData jadi objek kolom tabel.
function planFields(formData) {
  const post_date = dateOrNull(formData.get("post_date"));
  // plan_month diambil dari post_date; kalau kosong pakai field bulan eksplisit atau bulan ini.
  const explicitMonth = String(formData.get("plan_month") || "").trim(); // 'YYYY-MM'
  const plan_month =
    monthFirstDay(post_date) ||
    (/^\d{4}-\d{2}$/.test(explicitMonth) ? `${explicitMonth}-01` : null) ||
    `${new Date().toISOString().slice(0, 7)}-01`;

  // Platform target (checkbox "platforms"): minimal 1, nilai di luar daftar dibuang.
  // Link tayang IG/Threads dikumpulkan ke jsonb platform_links (TikTok tetap posted_url).
  const platforms = formData.getAll("platforms").map(String).filter((p) => PLATFORM_KEYS.includes(p));
  const platform_links = {};
  for (const p of PLATFORM_KEYS) {
    if (p === "tiktok") continue;
    const url = str(formData, `link_${p}`);
    if (url) platform_links[p] = url;
  }

  return {
    plan_month,
    post_date,
    platforms: platforms.length ? platforms : ["tiktok"],
    platform_links,
    seq: toIntOrNull(formData.get("seq")),
    pic: str(formData, "pic"),
    headline: str(formData, "headline"),
    topic: str(formData, "topic"),
    goals_content: str(formData, "goals_content"),
    primary_pillar: str(formData, "primary_pillar"),
    secondary_pillar: str(formData, "secondary_pillar"),
    content_type: str(formData, "content_type"),
    reference_url: str(formData, "reference_url"),
    posted_url: str(formData, "posted_url"),
    notes: str(formData, "notes"),
    acc_to_posting: String(formData.get("acc_to_posting") || "") === "on" || String(formData.get("acc_to_posting") || "") === "true",
    status_override: str(formData, "status_override"),
  };
}

// Buat baris rencana baru.
export async function createPlan(formData) {
  const profile = await getCurrentProfile();
  if (!profile?.role) throw new Error("Belum login.");
  const accountId = String(formData.get("accountId") || "");
  if (!accountId) throw new Error("Cabang wajib dipilih.");

  const fields = planFields(formData);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("content_plans").insert({
    tiktok_account_id: accountId,
    ...fields,
    created_by: profile.id,
    created_by_email: profile.email,
  });
  if (error) throw new Error(`Gagal menyimpan rencana: ${error.message}`);
  await logActivity(supabase, { action: "tambah_rencana_konten", entity: accountId, detail: { headline: fields.headline } });
  revalidatePath("/content-plan");
}

// Perbarui baris rencana (RLS: pemilik atau admin/manager).
export async function updatePlan(formData) {
  const profile = await getCurrentProfile();
  if (!profile?.role) throw new Error("Belum login.");
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("ID rencana tidak ada.");

  const fields = planFields(formData);
  const patch = { ...fields, updated_at: new Date().toISOString() };
  // Pindah cabang: kalau accountId dikirim, ikut ubah tiktok_account_id. RLS
  // (cplan_update WITH CHECK) memastikan user memang boleh menaruh di cabang tujuan.
  const accountId = String(formData.get("accountId") || "").trim();
  if (accountId) patch.tiktok_account_id = accountId;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("content_plans").update(patch).eq("id", id);
  if (error) throw new Error(`Gagal memperbarui rencana: ${error.message}`);
  await logActivity(supabase, { action: "ubah_rencana_konten", entity: id, detail: accountId ? { moved_to: accountId } : undefined });
  revalidatePath("/content-plan");
}

// Hapus baris rencana (RLS: pemilik atau admin).
export async function deletePlan(formData) {
  const profile = await getCurrentProfile();
  if (!profile?.role) throw new Error("Belum login.");
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("content_plans").delete().eq("id", id);
  if (error) throw new Error(`Gagal menghapus rencana: ${error.message}`);
  await logActivity(supabase, { action: "hapus_rencana_konten", entity: id });
  revalidatePath("/content-plan");
}

// GANTI RENCANA: tandai rencana lama 'Replaced' + tautkan ke penggantinya.
// mode 'new'      -> buat rencana baru dari field form, lalu tautkan.
// mode 'existing' -> tautkan ke rencana yang sudah ada (newId).
// Rencana lama tetap ada (redup di UI, label "Digantikan oleh …").
export async function replacePlan(formData) {
  const profile = await getCurrentProfile();
  if (!profile?.role) throw new Error("Belum login.");
  const oldId = String(formData.get("oldId") || "");
  if (!oldId) throw new Error("Rencana yang diganti tidak ada.");
  const mode = String(formData.get("mode") || "new");
  const supabase = await createSupabaseServerClient();

  let newId = null;
  if (mode === "existing") {
    newId = parseInt(String(formData.get("newId") || ""), 10);
    if (!newId) throw new Error("Pilih rencana pengganti dulu.");
    if (String(newId) === String(oldId)) throw new Error("Rencana pengganti tidak boleh sama dengan yang diganti.");
  } else {
    // Buat rencana baru sebagai pengganti.
    const accountId = String(formData.get("accountId") || "");
    if (!accountId) throw new Error("Cabang wajib dipilih.");
    const fields = planFields(formData);
    if (!fields.headline && !fields.post_date) throw new Error("Isi minimal Headline atau Tanggal untuk rencana pengganti.");
    const { data, error } = await supabase
      .from("content_plans")
      .insert({ tiktok_account_id: accountId, ...fields, created_by: profile.id, created_by_email: profile.email })
      .select("id")
      .single();
    if (error) throw new Error(`Gagal membuat rencana pengganti: ${error.message}`);
    newId = data.id;
  }

  // Tautkan rencana lama -> pengganti + status Replaced.
  const { error: e2 } = await supabase
    .from("content_plans")
    .update({ replaced_by_id: newId, status_override: "Replaced", updated_at: new Date().toISOString() })
    .eq("id", oldId);
  if (e2) throw new Error(`Gagal menandai rencana lama: ${e2.message}`);
  await logActivity(supabase, { action: "ganti_rencana_konten", entity: oldId, detail: { mode, replaced_by: newId } });
  revalidatePath("/content-plan");
  return { newId };
}

// BATALKAN penggantian: lepas tautan replaced_by_id + status_override -> rencana aktif
// lagi. HANYA menyentuh 2 kolom itu (tidak lewat planFields, supaya field lain aman).
export async function unreplacePlan(formData) {
  const profile = await getCurrentProfile();
  if (!profile?.role) throw new Error("Belum login.");
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("ID rencana tidak ada.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("content_plans")
    .update({ replaced_by_id: null, status_override: null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Gagal membatalkan penggantian: ${error.message}`);
  await logActivity(supabase, { action: "batal_ganti_rencana_konten", entity: id });
  revalidatePath("/content-plan");
}

// Set cepat link konten tayang (posted_url) dari input inline di tabel. Setelah ini
// status akan otomatis dihitung ulang (Verified bila cocok data report).
export async function setPostedUrl(formData) {
  const profile = await getCurrentProfile();
  if (!profile?.role) throw new Error("Belum login.");
  const id = String(formData.get("id") || "");
  if (!id) return;
  const url = String(formData.get("posted_url") || "").trim() || null;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("content_plans")
    .update({ posted_url: url, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Gagal menyimpan link: ${error.message}`);
  await logActivity(supabase, { action: "set_link_tayang_rencana", entity: id });
  revalidatePath("/content-plan");
  revalidatePath("/dashboard");
}

// Set cepat link tayang platform NON-TikTok (Instagram/Threads) dari input inline.
// Merge di server (baca jsonb lama dulu) supaya link platform lain tidak tertimpa.
export async function setPlatformLink(formData) {
  const profile = await getCurrentProfile();
  if (!profile?.role) throw new Error("Belum login.");
  const id = String(formData.get("id") || "");
  const platform = String(formData.get("platform") || "");
  if (!id) return;
  if (platform === "tiktok") return setPostedUrl(formData); // TikTok tetap lewat posted_url
  if (!PLATFORM_KEYS.includes(platform)) throw new Error("Platform tidak dikenal.");

  const url = String(formData.get("posted_url") || "").trim();
  const supabase = await createSupabaseServerClient();
  const { data: row, error: e1 } = await supabase.from("content_plans").select("platform_links").eq("id", id).single();
  if (e1) throw new Error(`Gagal membaca rencana: ${e1.message}`);
  const links = { ...(row?.platform_links || {}) };
  if (url) links[platform] = url; else delete links[platform];

  const { error } = await supabase
    .from("content_plans")
    .update({ platform_links: links, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Gagal menyimpan link: ${error.message}`);
  await logActivity(supabase, { action: "set_link_tayang_rencana", entity: id, detail: { platform } });
  revalidatePath("/content-plan");
  revalidatePath("/dashboard");
}

// ————————————————————————————————————————————————————————————————
// IMPORT MASSAL dari Excel (.xlsx) dengan MAPPING per-Outlet -> cabang.
// Alur 2 langkah: (1) analyzePlansExcel — parse & rangkum Outlet + contoh (TANPA
// simpan) untuk pratinjau; (2) importPlansExcelMapped — terima peta Outlet->cabang,
// rutekan tiap baris ke cabang yang benar, dedup per-cabang, lalu insert.
// Parsing murni di lib/tiktok/plan-import.js (teruji terpisah).
// ————————————————————————————————————————————————————————————————

// Ambil File dari FormData atau lempar error yang jelas.
function requireFile(formData) {
  const file = formData.get("file");
  if (!file || typeof file.arrayBuffer !== "function") throw new Error("File Excel tidak ditemukan.");
  return file;
}

// LANGKAH 1: analisa file untuk pratinjau (tidak menyimpan apa pun).
export async function analyzePlansExcel(formData) {
  const profile = await getCurrentProfile();
  if (!profile?.role) throw new Error("Belum login.");
  const file = requireFile(formData);
  const sheetName = String(formData.get("sheetName") || "").trim() || undefined;

  const { parsePlanWorkbook, summarizeOutlets } = await import("@/lib/tiktok/plan-import");
  const parsed = await parsePlanWorkbook(Buffer.from(await file.arrayBuffer()), { sheetName });
  return {
    sheetNames: parsed.sheetNames,
    sheetUsed: parsed.sheetUsed,
    totalRows: parsed.records.length,
    skippedEmpty: parsed.skippedEmpty,
    outlets: summarizeOutlets(parsed.records), // [{value, count}]
    sample: parsed.records.slice(0, 8).map((r) => ({ post_date: r.post_date, plan_month: r.plan_month, headline: r.headline, outlet: r.outlet })),
  };
}

// LANGKAH 2: impor dengan peta Outlet->cabang. `mapping` = JSON { byOutlet: {outletValue: accountId} }.
// Baris dengan Outlet yang tidak dipetakan (accountId kosong) dilewati (skippedUnmapped).
export async function importPlansExcelMapped(formData) {
  const profile = await getCurrentProfile();
  if (!profile?.role) throw new Error("Belum login.");
  const file = requireFile(formData);
  const sheetName = String(formData.get("sheetName") || "").trim() || undefined;
  let byOutlet = {};
  try {
    const m = JSON.parse(String(formData.get("mapping") || "{}"));
    byOutlet = m.byOutlet && typeof m.byOutlet === "object" ? m.byOutlet : {};
  } catch {
    throw new Error("Peta Outlet tidak valid.");
  }

  const { parsePlanWorkbook } = await import("@/lib/tiktok/plan-import");
  const { records, skippedEmpty } = await parsePlanWorkbook(Buffer.from(await file.arrayBuffer()), { sheetName });

  // Kelompokkan baris per cabang tujuan (berdasar Outlet). Lewati yang tak dipetakan.
  const byAcc = new Map(); // accountId -> [rec...]
  let skippedUnmapped = 0;
  for (const rec of records) {
    const acc = byOutlet[rec.outlet || ""];
    if (!acc) { skippedUnmapped += 1; continue; }
    if (!byAcc.has(acc)) byAcc.set(acc, []);
    byAcc.get(acc).push(rec);
  }
  const accIds = [...byAcc.keys()];
  if (accIds.length === 0) {
    return { inserted: 0, byBranch: [], skippedDup: 0, skippedEmpty, skippedUnmapped };
  }

  // Dedup per-cabang: ambil headline+tanggal yang sudah ada di cabang-cabang terlibat.
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("content_plans")
    .select("tiktok_account_id, headline, post_date")
    .in("tiktok_account_id", accIds);
  const seen = new Set((existing || []).map((r) => `${r.tiktok_account_id}|${(r.headline || "").toLowerCase().trim()}|${(r.post_date || "").slice(0, 10)}`));

  let skippedDup = 0;
  const rows = [];
  const perBranch = new Map();
  for (const [acc, recs] of byAcc) {
    for (const rec of recs) {
      const key = `${acc}|${(rec.headline || "").toLowerCase().trim()}|${rec.post_date || ""}`;
      if (seen.has(key)) { skippedDup += 1; continue; }
      seen.add(key);
      const { outlet, ...cols } = rec; // buang 'outlet' (bukan kolom DB)
      rows.push({ tiktok_account_id: acc, ...cols, created_by: profile.id, created_by_email: profile.email });
      perBranch.set(acc, (perBranch.get(acc) || 0) + 1);
    }
  }

  let inserted = 0;
  if (rows.length > 0) {
    const { error } = await supabase.from("content_plans").insert(rows);
    if (error) throw new Error(`Gagal menyimpan ${rows.length} baris: ${error.message}`);
    inserted = rows.length;
    await logActivity(supabase, { action: "import_rencana_konten", entity: accIds.join(","), detail: { inserted, skippedDup, skippedEmpty, skippedUnmapped, branches: accIds.length } });
    revalidatePath("/content-plan");
  }

  return {
    inserted,
    byBranch: [...perBranch.entries()].map(([accountId, count]) => ({ accountId, count })),
    skippedDup,
    skippedEmpty,
    skippedUnmapped,
  };
}

// Toggle cepat ACC to POSTING (checkbox di tabel).
export async function toggleAcc(formData) {
  const profile = await getCurrentProfile();
  if (!profile?.role) throw new Error("Belum login.");
  const id = String(formData.get("id") || "");
  const next = String(formData.get("next") || "") === "true";
  if (!id) return;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("content_plans")
    .update({ acc_to_posting: next, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Gagal mengubah ACC: ${error.message}`);
  revalidatePath("/content-plan");
}
