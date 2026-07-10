// File: app/api/report/portfolio-excel/route.js
// Export laporan Excel "Ringkasan Semua Cabang" (§9 & §25): KPI portofolio + tabel
// ranking semua cabang. Runtime Node (exceljs). Auth via sesi (RLS: cabang yang boleh diakses).

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { loadPortfolio } from "@/lib/tiktok/analytics";
import ExcelJS from "exceljs";

export const runtime = "nodejs";

export async function GET(request) {
  const profile = await getCurrentProfile();
  if (!profile?.role) return new Response(JSON.stringify({ error: "Belum login." }), { status: 401 });

  const monthParam = new URL(request.url).searchParams.get("month");
  const month = /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : null;

  const supabase = await createSupabaseServerClient();
  const { branches, portfolio } = await loadPortfolio(supabase, { month });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Elio Sosmed Analyst";
  const ws = wb.addWorksheet("Ringkasan Semua Cabang");
  ws.columns = [{ width: 26 }, { width: 18 }, { width: 12 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 10 }];

  ws.addRow([`Ringkasan Semua Cabang${month ? ` — ${month}` : " — sepanjang masa"}`]);
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.addRow([]);

  ws.addRow(["KPI Portofolio", "Nilai"]).font = { bold: true };
  [
    ["Cabang aktif", portfolio.activeBranches],
    [month ? `Total konten ${month}` : "Total konten bulan ini", portfolio.totalContentThisMonth],
    ["Total views", portfolio.totalViews],
    ["Net pertumbuhan follower", portfolio.netFollowerGrowth],
    ["Avg engagement rate (%)", portfolio.avgEngagementRate],
  ].forEach((r) => ws.addRow(r));
  ws.addRow([]);

  ws.addRow(["Cabang", "Username", "Konten/bln", "Total Views", "Eng. Rate (%)", "Follower Δ", "Status"]).font = { bold: true };
  branches.forEach((b) => ws.addRow([
    b.nama_cabang,
    b.tiktok_username ? `@${b.tiktok_username}` : "-",
    b.contentThisMonth,
    b.totalViews,
    b.engagementRate,
    b.netFollowerGrowth,
    b.status,
  ]));

  const buffer = await wb.xlsx.writeBuffer();
  const fileSuffix = month ? `_${month}` : "";
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Laporan_Semua_Cabang${fileSuffix}.xlsx"`,
    },
  });
}
