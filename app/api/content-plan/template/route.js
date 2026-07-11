// File: app/api/content-plan/template/route.js
// Unduh template Excel (.xlsx) untuk import massal Rencana Konten. Header di sini
// HARUS cocok dengan alias di app/content-plan/actions.js (importPlansExcel).
// Berisi baris contoh + sheet petunjuk singkat. Butuh login. Runtime Node (exceljs).

import ExcelJS from "exceljs";
import { getCurrentProfile } from "@/lib/auth";

export const runtime = "nodejs";

// Kolom template — urutan & judul ramah tim, tetap terbaca parser.
const COLUMNS = [
  { header: "No", key: "no", width: 6 },
  { header: "Tanggal Post", key: "post_date", width: 14 },
  { header: "PIC", key: "pic", width: 16 },
  { header: "Headline / Hook", key: "headline", width: 34 },
  { header: "Topic / Redaksi", key: "topic", width: 34 },
  { header: "Goals Content", key: "goals", width: 18 },
  { header: "Primary Pillar", key: "primary", width: 18 },
  { header: "Secondary Pillar", key: "secondary", width: 18 },
  { header: "Type of Content", key: "type", width: 16 },
  { header: "Reference Content", key: "reference", width: 26 },
  { header: "Link Tayang", key: "posted", width: 26 },
  { header: "Keterangan", key: "notes", width: 24 },
  { header: "ACC", key: "acc", width: 8 },
  { header: "Outlet", key: "outlet", width: 18 },
];

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile?.role) return new Response("Unauthorized", { status: 401 });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Elio Digihub";
  const ws = wb.addWorksheet("Rencana Konten");
  ws.columns = COLUMNS;

  // Header tebal + latar teal.
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF006674" } };
  head.alignment = { vertical: "middle" };
  head.height = 20;

  // Baris contoh (dihapus tim sebelum/ saat mengisi — tetap aman kalau ikut terimpor
  // karena dedup headline+tanggal, tapi sebaiknya diganti data asli).
  ws.addRow({
    no: 1, post_date: "2026-07-15", pic: "Nama PIC",
    headline: 'Contoh: "Family Cafe" promo akhir pekan',
    topic: "Footage: suasana kafe ramai keluarga, b-roll menu…",
    goals: "Awareness", primary: "Entertainment", secondary: "Education",
    type: "Video", reference: "https://www.tiktok.com/@contoh/video/123",
    posted: "", notes: "", acc: "Ya", outlet: "Elio Coffee House",
  });
  ws.getRow(2).font = { italic: true, color: { argb: "FF64748B" } };

  // Format kolom tanggal sebagai teks tanggal ISO agar konsisten.
  ws.getColumn("post_date").numFmt = "yyyy-mm-dd";
  ws.views = [{ state: "frozen", ySplit: 1 }];

  // Sheet petunjuk.
  const guide = wb.addWorksheet("Petunjuk");
  guide.columns = [{ width: 100 }];
  const lines = [
    "CARA PAKAI TEMPLATE INI",
    "",
    "1. Isi tiap baris = satu rencana konten. Baris 2 (contoh) boleh dihapus/diganti.",
    "2. Kolom WAJIB minimal salah satu: Tanggal Post ATAU Headline/Hook (baris kosong dilewati).",
    "3. Tanggal Post: format YYYY-MM-DD (mis. 2026-07-15) atau DD/MM/YYYY.",
    "4. ACC: isi 'Ya' bila sudah disetujui untuk posting, kosongkan bila belum.",
    "5. Link Tayang: kosongkan saat perencanaan; diisi setelah konten tayang (status jadi Verified otomatis).",
    "6. Goals/Pillar/Type sebaiknya sesuai kategori di Pengaturan (boleh teks bebas).",
    "7. OUTLET (opsional): isi nama outlet/cabang bila 1 file memuat banyak cabang. Saat import, tiap nilai Outlet dipetakan ke cabang lewat langkah pratinjau. Kosongkan bila semua baris untuk 1 cabang.",
    "8. Simpan sebagai .xlsx, lalu unggah di halaman Rencana → tombol 'Import Excel'.",
    "",
    "CATATAN: Baris dengan Headline+Tanggal yang sudah ada tidak akan diduplikasi.",
    "Import bersifat MENAMBAH (tidak menghapus rencana yang sudah ada).",
  ];
  lines.forEach((t, i) => {
    const row = guide.addRow([t]);
    if (i === 0) row.font = { bold: true, size: 13, color: { argb: "FF006674" } };
  });

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Template_Rencana_Konten_Elio.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
