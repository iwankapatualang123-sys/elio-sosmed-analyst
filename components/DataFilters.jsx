// File: components/DataFilters.jsx
// Filter cabang + bulan untuk halaman Data (client). Navigasi ke /data?branch=&month=
// saat pilihan berubah (blueprint bagian 20 & 21A: filter periode).

"use client";

import { useRouter } from "next/navigation";

// Nama bulan Indonesia untuk label dropdown (dari string 'YYYY-MM').
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
function labelBulan(ym) {
  if (ym === "all") return "Semua bulan";
  const [y, m] = ym.split("-");
  return `${BULAN[Number(m) - 1] || m} ${y}`;
}

export default function DataFilters({ branches = [], months = [], selectedBranch, selectedMonth, basePath = "/data" }) {
  const router = useRouter();

  function go(branch, month) {
    router.push(`${basePath}?branch=${branch}&month=${month}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-white">
        Cabang
        <select
          className="input-3d"
          value={selectedBranch || ""}
          onChange={(e) => go(e.target.value, selectedMonth)}
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nama_cabang}{b.tiktok_username ? ` (@${b.tiktok_username})` : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-white">
        Bulan
        <select
          className="input-3d"
          value={selectedMonth || "all"}
          onChange={(e) => go(selectedBranch, e.target.value)}
        >
          <option value="all">Semua bulan</option>
          {months.map((m) => (
            <option key={m} value={m}>{labelBulan(m)}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
