// File: components/MonthFilter.jsx
// Dropdown filter BULAN untuk Dashboard (client) — beda dari DataFilters (yang
// gabung cabang+bulan dalam 1 komponen bergaya <select> utk cabang); Dashboard
// pilih cabang lewat pill/Link terpisah, jadi filter bulan ini berdiri sendiri dan
// menjaga parameter lain (branch, cat) yang sudah ada di URL saat berpindah bulan.

"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
function labelBulan(ym) {
  const [y, m] = ym.split("-");
  return `${BULAN[Number(m) - 1] || m} ${y}`;
}

export default function MonthFilter({ months = [] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedMonth = searchParams.get("month") || "all";

  function go(month) {
    const params = new URLSearchParams(searchParams.toString());
    if (month === "all") params.delete("month");
    else params.set("month", month);
    router.push(`${pathname}?${params.toString()}`);
  }

  if (months.length === 0) return null;

  return (
    <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: "rgba(255,255,255,.85)" }}>
      Tinjau bulan
      <select
        className="input-3d !min-h-0 !py-1.5 text-sm"
        value={selectedMonth}
        onChange={(e) => go(e.target.value)}
      >
        <option value="all">Semua bulan (sepanjang masa)</option>
        {months.map((m) => <option key={m} value={m}>{labelBulan(m)}</option>)}
      </select>
    </label>
  );
}
