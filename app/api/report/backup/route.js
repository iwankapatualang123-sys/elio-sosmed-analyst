// File: app/api/report/backup/route.js
// Backup manual seluruh data ke satu file Excel (blueprint 21F — penting di paket
// Free yang tanpa backup otomatis). Admin only. Runtime Node.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import ExcelJS from "exceljs";

export const runtime = "nodejs";

const TABLES = [
  ["Cabang", "tiktok_accounts"],
  ["Konten", "tiktok_content"],
  ["Overview", "tiktok_daily_overview"],
  ["Follower", "tiktok_follower_history"],
  ["Gender", "tiktok_follower_gender"],
  ["Territories", "tiktok_follower_territories"],
  ["Activity", "tiktok_follower_activity"],
  ["Viewers", "tiktok_viewers"],
];

export async function GET() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") {
    return new Response(JSON.stringify({ error: "Hanya admin." }), { status: 403 });
  }
  const supabase = await createSupabaseServerClient();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Elio Sosmed Analyst";

  for (const [sheetName, table] of TABLES) {
    const { data } = await supabase.from(table).select("*").limit(50000);
    const ws = wb.addWorksheet(sheetName);
    const rows = data || [];
    if (rows.length === 0) {
      ws.addRow(["(tidak ada data)"]);
      continue;
    }
    const cols = Object.keys(rows[0]);
    ws.addRow(cols).font = { bold: true };
    rows.forEach((r) => ws.addRow(cols.map((c) => (typeof r[c] === "object" && r[c] !== null ? JSON.stringify(r[c]) : r[c]))));
  }

  const buffer = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Backup_Elio_${date}.xlsx"`,
    },
  });
}
