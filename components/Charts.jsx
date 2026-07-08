// File: components/Charts.jsx
// Grafik SVG ringan (tanpa dependency), on-theme teal/hijau. Semua komponen murni
// (props -> SVG), dirender di server. Responsif via viewBox + width 100%.
// Dipakai dashboard (blueprint bagian 4). Warna mengikuti palet globals.css.

const PALETTE = ["#006674", "#4f9e7a", "#7fbf8f", "#93bcad", "#00545e", "#b9dcc6"];

// Komponen: BarChart — bar vertikal dengan label & nilai. data: [{label, value}].
export function BarChart({ data = [], height = 180, unit = "" }) {
  if (data.length === 0) return <Empty height={height} />;
  const max = Math.max(...data.map((d) => d.value), 1);
  const w = 100 / data.length;
  return (
    <svg viewBox="0 0 100 60" width="100%" style={{ height }} preserveAspectRatio="none" role="img">
      {data.map((d, i) => {
        const barH = (d.value / max) * 44;
        const x = i * w + w * 0.2;
        const bw = w * 0.6;
        return (
          <g key={i}>
            <rect x={x} y={50 - barH} width={bw} height={barH} rx="1.2" fill={PALETTE[i % PALETTE.length]} />
          </g>
        );
      })}
    </svg>
  );
}

// Komponen: BarChartLabeled — versi dengan label & nilai (dipakai grafik jam terbaik).
export function BarChartLabeled({ data = [], height = 200, format = (v) => v }) {
  if (data.length === 0) return <Empty height={height} />;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ height, display: "flex", alignItems: "flex-end", gap: 8, paddingTop: 18 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)" }}>{format(d.value)}</span>
          <div
            title={`${d.label}: ${format(d.value)}`}
            style={{
              width: "70%",
              height: `${(d.value / max) * 100}%`,
              minHeight: 4,
              borderRadius: "6px 6px 3px 3px",
              background: `linear-gradient(180deg, #64b98f, ${PALETTE[i % PALETTE.length]})`,
              boxShadow: "0 3px 6px rgba(0,60,68,.25)",
            }}
          />
          <span style={{ fontSize: 10, color: "var(--ink-soft)", marginTop: 4 }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// Komponen: LineChart — garis + area untuk tren. data: [{x(label), y(value)}].
export function LineChart({ data = [], height = 180 }) {
  if (data.length < 2) return <Empty height={height} />;
  const ys = data.map((d) => d.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const range = max - min || 1;
  const W = 100;
  const H = 50;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((d.y - min) / range) * (H - 6) - 3;
    return [x, y];
  });
  const line = pts.map((p) => `${p[0]},${p[1]}`).join(" ");
  const area = `0,${H} ${line} ${W},${H}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height }} preserveAspectRatio="none" role="img">
      <defs>
        <linearGradient id="lc-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4f9e7a" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#4f9e7a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#lc-area)" />
      <polyline points={line} fill="none" stroke="#006674" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Komponen: Donut — donat proporsi. data: [{label, value, color?}]. showCenter: teks tengah.
export function Donut({ data = [], size = 160, center = null }) {
  const total = data.reduce((s, d) => s + (d.value || 0), 0);
  if (total <= 0) return <Empty height={size} />;
  const r = 42;
  const c = 50;
  const circ = 2 * Math.PI * r;
  // Precompute segmen + offset kumulatif secara murni (tanpa mutasi saat render).
  const segments = data.map((d, i) => {
    const dash = ((d.value || 0) / total) * circ;
    const offset = data.slice(0, i).reduce((s, x) => s + ((x.value || 0) / total) * circ, 0);
    return { label: d.label, value: d.value || 0, dash, offset, color: d.color || PALETTE[i % PALETTE.length] };
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img">
        <circle cx={c} cy={c} r={r} fill="none" stroke="#eaf4ec" strokeWidth="14" />
        {segments.map((seg, i) => (
          <circle
            key={i}
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="14"
            strokeDasharray={`${seg.dash} ${circ - seg.dash}`}
            strokeDashoffset={-seg.offset}
            transform="rotate(-90 50 50)"
          />
        ))}
        {center && (
          <text x="50" y="54" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--ink)">
            {center}
          </text>
        )}
      </svg>
      <ul style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
        {segments.map((seg, i) => (
          <li key={i} style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink)" }}>
            <span style={{ width: 12, height: 12, borderRadius: 4, background: seg.color, display: "inline-block" }} />
            {seg.label} <b style={{ marginLeft: "auto" }}>{Math.round((seg.value / total) * 100)}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Komponen: Empty — placeholder saat data kosong.
function Empty({ height = 160 }) {
  return (
    <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-soft)", fontSize: 13 }}>
      Belum ada data
    </div>
  );
}
