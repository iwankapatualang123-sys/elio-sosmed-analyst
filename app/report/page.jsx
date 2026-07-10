// File: app/report/page.jsx
// Halaman index Laporan — pilih cabang/akun mana yang mau di-lihat/di-download
// laporannya (PDF cetak + Excel), tanpa harus lewat Dashboard dulu. Juga pintasan
// ke Laporan Semua Cabang (portofolio). RLS otomatis membatasi cabang yang
// tampil sesuai akses user (admin lihat semua, staff cuma cabang yang di-assign).

import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import Button from "@/components/Button";
import MonthFilter from "@/components/MonthFilter";
import { FileText, Download, LayoutGrid } from "lucide-react";

const BULAN_NAMA = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
function labelBulan(ym) {
  const [y, m] = ym.split("-");
  return `${BULAN_NAMA[Number(m) - 1] || m} ${y}`;
}

export default async function ReportIndexPage({ searchParams }) {
  const profile = await getCurrentProfile();
  if (!profile?.role) {
    return (
      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 p-6">
        <Nav email={profile?.email} role={profile?.role} />
        <section className="card-3d p-6"><p className="text-sm" style={{ color: "var(--ink-soft)" }}>Hubungi admin untuk mengaktifkan akses cabang.</p></section>
      </main>
    );
  }

  const sp = (await searchParams) || {};
  const month = /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : null;
  const monthQS = month ? `month=${month}` : "";

  const supabase = await createSupabaseServerClient();
  const { data: branchesRaw } = await supabase
    .from("tiktok_accounts")
    .select("id, nama_cabang, tiktok_username, kategori, is_active")
    .order("nama_cabang");
  // Aktif dulu, lalu yang diarsipkan (tetap ditampilkan — laporan akhir cabang yang
  // sudah nonaktif tetap berguna, sama seperti Rencana Konten).
  const branches = [...(branchesRaw || [])].sort((a, b) => (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0));

  // Daftar bulan tersedia (gabungan SEMUA cabang di atas, termasuk yg diarsipkan)
  // utk isi dropdown "Tinjau bulan" — 1 query gabungan, bukan per-cabang.
  const branchIds = branches.map((b) => b.id);
  const monthSet = new Set();
  if (branchIds.length > 0) {
    const [{ data: contentDates }, { data: historyDates }] = await Promise.all([
      supabase.from("tiktok_content").select("post_date").in("tiktok_account_id", branchIds),
      supabase.from("tiktok_follower_history").select("date").in("tiktok_account_id", branchIds),
    ]);
    (contentDates || []).forEach((r) => r.post_date && monthSet.add(r.post_date.slice(0, 7)));
    (historyDates || []).forEach((r) => r.date && monthSet.add(r.date.slice(0, 7)));
  }
  const months = [...monthSet].sort().reverse();

  return (
    <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-5 p-4 sm:p-6">
      <Nav email={profile.email} role={profile.role} />

      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-sm sm:text-3xl">Laporan</h1>
          <p className="mt-0.5 text-sm" style={{ color: "rgba(255,255,255,.75)" }}>
            {month ? `Semua laporan di bawah discope ke ${labelBulan(month)}.` : "Pilih cabang untuk lihat/download laporannya (PDF & Excel) — atau unduh laporan gabungan semua cabang."}
          </p>
        </div>
        <MonthFilter months={months} />
      </div>

      {/* Laporan Semua Cabang */}
      <section className="card-3d flex flex-wrap items-center gap-3 p-4 sm:p-5">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: "linear-gradient(180deg,#0a8291,#00545e)" }}>
          <LayoutGrid size={20} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-ink">Laporan Semua Cabang</h2>
          <p className="text-xs" style={{ color: "var(--ink-soft)" }}>Ringkasan portofolio gabungan — semua cabang yang bisa Anda akses.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link href={`/report/portfolio${month ? `?${monthQS}` : ""}`}><Button variant="ghost"><FileText size={15} /> Lihat</Button></Link>
          <a href={`/api/report/portfolio-excel${month ? `?${monthQS}` : ""}`}><Button variant="success"><Download size={15} /> Excel</Button></a>
        </div>
      </section>

      {/* Daftar cabang */}
      <section className="flex flex-col gap-3">
        {branches.length === 0 && (
          <div className="card-3d p-6"><p className="text-sm" style={{ color: "var(--ink-soft)" }}>Belum ada cabang yang bisa diakses.</p></div>
        )}
        {branches.map((b) => (
          <div key={b.id} className="card-3d flex flex-wrap items-center gap-3 p-4 sm:p-5">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white" style={{ background: b.is_active ? "linear-gradient(180deg,#7fe0d0,#0a8291)" : "linear-gradient(180deg,#b7c7c5,#7c908d)" }}>
              {b.nama_cabang.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                {b.nama_cabang}
                {!b.is_active && (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(240,180,90,.2)", color: "#8a5a12" }}>Diarsipkan</span>
                )}
              </h2>
              <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
                @{b.tiktok_username}{b.kategori ? ` · ${b.kategori}` : ""}
              </p>
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              <Link href={`/report/${b.id}${month ? `?${monthQS}` : ""}`}><Button variant="ghost"><FileText size={15} /> Lihat</Button></Link>
              <a href={`/api/report/excel?branch=${b.id}${month ? `&${monthQS}` : ""}`}><Button variant="success"><Download size={15} /> Bulanan</Button></a>
              <a href={`/api/report/weekly-excel?branch=${b.id}${month ? `&${monthQS}` : ""}`}><Button variant="success"><Download size={15} /> Mingguan</Button></a>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
