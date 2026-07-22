// File: components/InfoRail.jsx
// SIDEBAR KANAN (informasi) — panel kaca melayang yang muncul di semua halaman
// ber-login. Isinya MURNI informatif (tanpa kontrol): ringkasan halaman aktif,
// panduan cara baca metrik, dan tips. Tampil hanya di layar lebar (xl) supaya
// area konten tetap lega; offset diatur di globals.css (body:has(aside.info-rail)).

"use client";

import { usePathname } from "next/navigation";
import { Info, BookOpen, Lightbulb } from "lucide-react";

// Ringkasan + tips per halaman (informatif, bukan aksi).
const PAGES = [
  { m: "/dashboard", title: "Dashboard", desc: "Ringkasan performa seluruh cabang. Gunakan filter bulan untuk mengevaluasi periode tertentu.", tips: ["Klik nama cabang untuk melihat detailnya.", "Peringkat cabang membantu menemukan yang perlu perhatian."] },
  { m: "/data", title: "Data Cabang", desc: "Semua konten, follower, dan audiens mentah per cabang dalam bentuk galeri & tabel.", tips: ["Urutkan konten berdasarkan Views atau ER.", "Cari judul video lewat kotak pencarian."] },
  { m: "/report", title: "Laporan", desc: "Unduh laporan per cabang (bulanan/mingguan) atau gabungan semua cabang.", tips: ["File Excel berisi ringkasan KPI + data mentah.", "Pilih bulan dulu untuk laporan periode tertentu."] },
  { m: "/content-plan", title: "Rencana Konten", desc: "Kalender rencana produksi konten bulanan beserta status verifikasinya.", tips: ["Tandai konten yang sudah diverifikasi.", "Rencana lama tetap tersimpan sebagai arsip."] },
  { m: "/calendar", title: "Kalender", desc: "Kapan video diposting dan performanya per tanggal.", tips: ["Warna menandai kepadatan posting.", "Konsistensi posting menjaga jangkauan."] },
  { m: "/upload", title: "Upload", desc: "Impor data konten TikTok/Instagram dari file ekspor.", tips: ["Gunakan template kolom yang disediakan.", "Data duplikat otomatis diperbarui."] },
  { m: "/search", title: "Pencarian", desc: "Cari cabang atau video di seluruh akun yang bisa Anda akses.", tips: ["Ketik nama cabang atau judul video.", "Hasil mengikuti hak akses Anda."] },
  { m: "/activity", title: "Log Aktivitas", desc: "Jejak aktivitas pengguna untuk audit & keamanan.", tips: ["Pantau perubahan penting di sini.", "Hanya admin yang dapat mengakses."] },
  { m: "/settings", title: "Pengaturan", desc: "Kelola pengguna, cabang, dan hak akses aplikasi.", tips: ["Beri akses cabang lewat penugasan.", "Nonaktifkan akun tanpa menghapus data."] },
  { m: "/account", title: "Akun", desc: "Profil dan keamanan akun Anda.", tips: ["Ganti password secara berkala.", "Sesi otomatis keluar saat idle."] },
];

// Legenda metrik universal (sama di semua halaman).
const METRICS = [
  { k: "Views", v: "Total tayangan sebuah video." },
  { k: "ER", v: "Engagement Rate = (like+komentar+share) ÷ views. Sehat ≥ 4%." },
  { k: "Follower", v: "Selisih follower per periode = pertumbuhan cabang." },
];

export default function InfoRail() {
  const pathname = usePathname() || "";
  const page = PAGES.find((p) => pathname === p.m || pathname.startsWith(`${p.m}/`)) || PAGES[0];

  return (
    <aside
      className="info-rail fixed right-3 top-6 z-30 hidden w-60 flex-col gap-3 overflow-y-auto xl:flex"
      style={{ height: "calc(100vh - 3rem)" }}
      aria-label="Panel informasi"
    >
      {/* Ringkasan halaman aktif */}
      <div className="card-3d p-3.5">
        <div className="mb-1.5 flex items-center gap-1.5">
          <Info size={13} style={{ color: "var(--teal-700)" }} aria-hidden />
          <h3 className="text-xs font-semibold text-ink">{page.title}</h3>
        </div>
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>{page.desc}</p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {page.tips.map((t, i) => (
            <li key={i} className="flex gap-1.5 text-[11px] leading-snug" style={{ color: "var(--ink-soft)" }}>
              <Lightbulb size={12} className="mt-0.5 flex-shrink-0" style={{ color: "#e0a63a" }} aria-hidden />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Panduan metrik */}
      <div className="card-3d p-3.5">
        <div className="mb-2 flex items-center gap-1.5">
          <BookOpen size={13} style={{ color: "var(--teal-700)" }} aria-hidden />
          <h3 className="text-xs font-semibold text-ink">Cara baca metrik</h3>
        </div>
        <dl className="flex flex-col gap-2">
          {METRICS.map((m) => (
            <div key={m.k}>
              <dt className="text-[11px] font-semibold text-ink">{m.k}</dt>
              <dd className="text-[11px] leading-snug" style={{ color: "var(--ink-soft)" }}>{m.v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="mt-auto px-1 pb-1 text-[10px]" style={{ color: "var(--on-bg-soft)" }}>
        Elio Sosmed Analyst · panel informasi
      </p>
    </aside>
  );
}
