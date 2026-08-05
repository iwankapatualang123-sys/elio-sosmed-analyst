// File: components/umum/FollowerGroupBars.jsx
// Perbandingan follower per outlet dengan BATANG BERKELOMPOK per platform.
// Server component (SVG/div murni). Tiap outlet menampilkan 1 batang per platform
// yang PUNYA data — jadi jumlah batang bertambah sendiri saat outlet mulai punya
// data di platform lain (TikTok / Instagram / Threads).

const fmt = (n) => Number(n || 0).toLocaleString("id-ID");
// Ringkas angka besar untuk label batang: 42rb, 1,2Jt.
function ringkas(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}Jt`;
  if (v >= 1_000) return `${Math.round(v / 1000)}rb`;
  return fmt(v);
}

const PLATFORMS = [
  { key: "tiktok", label: "TikTok", color: "#111111" },
  { key: "instagram", label: "Instagram", color: "#c13584" },
  { key: "threads", label: "Threads", color: "#5b63eb" },
];

export default function FollowerGroupBars({ outlets = [] }) {
  const max = Math.max(1, ...outlets.flatMap((o) => PLATFORMS.map((p) => o[p.key] || 0)));
  const active = PLATFORMS.filter((p) => outlets.some((o) => o[p.key] != null));

  if (!outlets.length) {
    return <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Belum ada data follower untuk ditampilkan.</p>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: "var(--ink-soft)" }}>
        {active.map((p) => (
          <span key={p.key} className="inline-flex items-center gap-1.5">
            <i style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, display: "inline-block" }} />
            {p.label}
          </span>
        ))}
      </div>
      <div className="flex items-end gap-5 overflow-x-auto pb-1" style={{ height: 200 }}>
        {outlets.map((o) => (
          <div key={o.id} className="flex min-w-[64px] flex-1 flex-col items-center gap-2">
            <div className="flex items-end gap-1.5" style={{ height: 150 }}>
              {active.map((p) => {
                const val = o[p.key];
                if (val == null) return null;
                const h = Math.max(3, Math.round((val / max) * 150));
                return (
                  <div key={p.key} className="relative flex flex-col items-center justify-end" title={`${p.label}: ${fmt(val)} follower`}>
                    <span className="mb-1 text-[9px] font-bold" style={{ color: "var(--ink-soft)" }}>{ringkas(val)}</span>
                    <div style={{ width: 16, height: h, borderRadius: "5px 5px 0 0", background: p.color }} />
                  </div>
                );
              })}
            </div>
            <div className="max-w-[80px] truncate text-center text-[11px] font-semibold" style={{ color: "var(--ink)" }} title={o.nama}>{o.nama}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
