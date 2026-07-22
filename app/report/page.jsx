// File: app/report/page.jsx
// Halaman index Laporan — pilih cabang/akun mana yang mau di-lihat/di-download
// laporannya (PDF cetak + Excel), tanpa harus lewat Dashboard dulu. Juga pintasan
// ke Laporan Semua Cabang (portofolio). RLS otomatis membatasi cabang yang
// tampil sesuai akses user (admin lihat semua, staff cuma cabang yang di-assign).

import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { createReadClient } from "@/lib/db-compat";
import Nav from "@/components/Nav";
import Button from "@/components/Button";
import MonthFilter from "@/components/MonthFilter";
import { FileText, Download, LayoutGrid, ChevronRight } from "lucide-react";

const BULAN_NAMA = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
function labelBulan(ym) {
  const [y, m] = ym.split("-");
  return `${BULAN_NAMA[Number(m) - 1] || m} ${y}`;
}

export default async function ReportIndexPage({ searchParams }) {
  const profile = await getCurrentProfile();
  if (!profile?.role) {
    return (
      <main className="relative z-10 mx-auto grid3 min-h-screen w-full max-w-5xl p-6">
        <Nav email={profile?.email} role={profile?.role} />
        <section className="card-3d p-6"><p className="text-sm" style={{ color: "var(--ink-soft)" }}>Hubungi admin untuk mengaktifkan akses cabang.</p></section>
      </main>
    );
  }

  const sp = (await searchParams) || {};
  const month = /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : null;
  const monthQS = month ? `month=${month}` : "";

  const supabase = await createReadClient(profile);
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
    <main className="relative z-10 mx-auto grid3 min-h-screen w-full max-w-5xl p-4 sm:p-6">
      <Nav email={profile.email} role={profile.role} />

      <div className="px-1">
        <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-sm sm:text-2xl">Laporan</h1>
        <p className="mt-0.5 text-[13px]" style={{ color: "var(--on-bg-soft)" }}>
          {month ? `Semua laporan discope ke ${labelBulan(month)}.` : "Pilih cabang untuk unduh laporannya (PDF & Excel), atau ambil laporan gabungan."}
        </p>
        <div className="mt-2"><MonthFilter months={months} /></div>
      </div>

      {/* Laporan Semua Cabang (kartu ringkas) */}
      <section className="card-3d flex flex-wrap items-center gap-3 p-3.5">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-white" style={{ background: "linear-gradient(180deg,#0a8291,#00545e)" }}>
          <LayoutGrid size={16} />
        </div>
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-ink">Laporan Semua Cabang</h2>
          <p className="text-[11px]" style={{ color: "var(--ink-soft)" }}>Ringkasan portofolio gabungan semua cabang.</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Link href={`/report/portfolio${month ? `?${monthQS}` : ""}`}><Button variant="ghost" className="btn-sm"><FileText size={13} /> Lihat</Button></Link>
          <a href={`/api/report/portfolio-excel${month ? `?${monthQS}` : ""}`}><Button variant="success" className="btn-sm"><Download size={13} /> Excel</Button></a>
        </div>
      </section>

      {/* Daftar cabang — kartu ramping dgn LIST unduhan modern (3 kolom di layar besar) */}
      <section className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {branches.length === 0 && (
          <div className="card-3d p-5 sm:col-span-2 lg:col-span-3"><p className="text-sm" style={{ color: "var(--ink-soft)" }}>Belum ada cabang yang bisa diakses.</p></div>
        )}
        {branches.map((b) => (
          <div key={b.id} className="card-3d flex flex-col p-3">
            {/* Header cabang */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white" style={{ background: b.is_active ? "linear-gradient(180deg,#7fe0d0,#0a8291)" : "linear-gradient(180deg,#b7c7c5,#7c908d)" }}>
                {b.nama_cabang.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                  <span className="truncate">{b.nama_cabang}</span>
                  {!b.is_active && (
                    <span className="flex-shrink-0 rounded-full px-1.5 py-px text-[9px] font-semibold" style={{ background: "rgba(240,180,90,.2)", color: "#8a5a12" }}>Arsip</span>
                  )}
                </h2>
                <p className="truncate text-[11px]" style={{ color: "var(--ink-soft)" }}>
                  @{b.tiktok_username}{b.kategori ? ` · ${b.kategori}` : ""}
                </p>
              </div>
            </div>

            {/* LIST unduhan — baris ikon + label + aksi (estetik & modern) */}
            <div className="mt-2.5 flex flex-col gap-0.5 border-t pt-2" style={{ borderColor: "var(--line)" }}>
              <Link href={`/report/${b.id}${month ? `?${monthQS}` : ""}`} className="dl-row">
                <span className="dl-ico" style={{ background: "rgba(0,102,116,.1)", color: "var(--teal-900)" }}><FileText size={14} /></span>
                <span className="dl-label">Lihat laporan</span>
                <ChevronRight size={15} className="dl-arrow" />
              </Link>
              <a href={`/api/report/excel?branch=${b.id}${month ? `&${monthQS}` : ""}`} className="dl-row">
                <span className="dl-ico" style={{ background: "rgba(79,158,122,.14)", color: "#2f6b4e" }}><Download size={14} /></span>
                <span className="dl-label">Excel bulanan<span className="dl-sub">.xlsx</span></span>
                <Download size={14} className="dl-arrow" />
              </a>
              <a href={`/api/report/weekly-excel?branch=${b.id}${month ? `&${monthQS}` : ""}`} className="dl-row">
                <span className="dl-ico" style={{ background: "rgba(79,158,122,.14)", color: "#2f6b4e" }}><Download size={14} /></span>
                <span className="dl-label">Excel mingguan<span className="dl-sub">.xlsx</span></span>
                <Download size={14} className="dl-arrow" />
              </a>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
