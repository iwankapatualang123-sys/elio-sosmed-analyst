// File: components/FollowerGrowthRange.jsx
// Grafik pertumbuhan follower BULANAN dengan pemilih RENTANG bulan (dari → sampai)
// supaya bisa membandingkan performa antar periode. Client component: filter deret
// bulanan (TikTok+IG) sesuai rentang terpilih tanpa reload halaman. LineChart di
// components/Charts.jsx adalah SVG murni (aman dipakai di client).

"use client";

import { useMemo, useState } from "react";
import { LineChart } from "@/components/Charts";

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
function labelBulan(ym) {
  const [y, m] = String(ym).split("-");
  return `${BULAN[Number(m) - 1] || m} ${y}`;
}
const fmt = (n) => Number(n || 0).toLocaleString("id-ID");

export default function FollowerGrowthRange({ ttMonthly = [], igMonthly = [] }) {
  // Daftar bulan tersedia (gabungan TikTok+IG), urut lama→baru.
  const months = useMemo(() => {
    const s = new Set([...ttMonthly, ...igMonthly].map((p) => p.x));
    return [...s].sort();
  }, [ttMonthly, igMonthly]);

  const [from, setFrom] = useState(() => months[0]);
  const [to, setTo] = useState(() => months[months.length - 1]);

  // Pastikan pilihan valid (mis. setelah pindah cabang) + urutkan (from ≤ to).
  const safeFrom = months.includes(from) ? from : months[0];
  const safeTo = months.includes(to) ? to : months[months.length - 1];
  const lo = safeFrom <= safeTo ? safeFrom : safeTo;
  const hi = safeFrom <= safeTo ? safeTo : safeFrom;
  const inRange = (x) => x >= lo && x <= hi;

  const ttF = ttMonthly.filter((p) => inRange(p.x));
  const igF = igMonthly.filter((p) => inRange(p.x));

  const series = [
    ...(ttF.length >= 1 ? [{ label: "TikTok", color: "#5b63eb", data: ttF }] : []),
    ...(igF.length >= 1 ? [{ label: "Instagram", color: "#c13584", data: igF }] : []),
  ];

  const rows = [["TikTok", ttF, "#5b63eb"], ["Instagram", igF, "#c13584"]];
  const jmlBulan = months.filter(inRange).length;

  return (
    <div>
      {/* Pemilih rentang bulan */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px]" style={{ color: "var(--ink-soft)" }}>
        <span className="font-medium">Bandingkan bulan:</span>
        <select value={safeFrom} onChange={(e) => setFrom(e.target.value)} className="input-3d !min-h-0 w-auto !py-1 !pl-2 !pr-6 text-xs" aria-label="Dari bulan">
          {months.map((m) => <option key={m} value={m}>{labelBulan(m)}</option>)}
        </select>
        <span aria-hidden>→</span>
        <select value={safeTo} onChange={(e) => setTo(e.target.value)} className="input-3d !min-h-0 w-auto !py-1 !pl-2 !pr-6 text-xs" aria-label="Sampai bulan">
          {months.map((m) => <option key={m} value={m}>{labelBulan(m)}</option>)}
        </select>
        <span className="text-[10px]">· {jmlBulan} bulan</span>
      </div>

      <LineChart series={series} />

      {/* Ringkasan rentang: total pertambahan + banding bulan awal vs akhir rentang. */}
      <div className="mt-2 flex flex-col gap-1 text-xs" style={{ color: "var(--ink-soft)" }}>
        {rows.map(([label, ser, color]) => {
          if (!ser.length) return null;
          const total = ser.reduce((s, p) => s + (Number(p.y) || 0), 0);
          const first = ser[0];
          const last = ser[ser.length - 1];
          const cmp = ser.length >= 2 ? (() => {
            const slower = first.y >= last.y;
            return (
              <> — <b className="text-ink">{labelBulan(first.x)}</b> ({first.y >= 0 ? "+" : ""}{fmt(first.y)}) {slower ? ">" : "<"} <b className="text-ink">{labelBulan(last.x)}</b> ({last.y >= 0 ? "+" : ""}{fmt(last.y)}), {slower ? "melambat" : "meningkat"}</>
            );
          })() : null;
          return (
            <p key={label}>
              <b style={{ color }}>{label}</b>: total <b className="text-ink">{total >= 0 ? "+" : ""}{fmt(total)}</b> follower di rentang{cmp}.
            </p>
          );
        })}
      </div>
      <p className="mt-1 text-[10px]" style={{ color: "var(--ink-soft)" }}>
        Garis = <b>pertambahan follower per bulan</b> (bukan jumlah total). Atur rentang di atas untuk membandingkan periode; pilih satu bulan di filter halaman untuk detail harian.
      </p>
    </div>
  );
}
