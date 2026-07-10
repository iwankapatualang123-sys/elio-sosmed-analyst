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

// Komponen: DivergingBarChart — bar naik (hijau) di atas garis nol untuk nilai
// positif, turun (merah) di bawah garis nol untuk nilai negatif. Dipakai untuk
// metrik yang BOLEH negatif (mis. pertumbuhan follower mingguan yang bisa turun)
// — BarChartLabeled biasa akan salah render kalau ada nilai negatif.
// data: [{label, value}].
export function DivergingBarChart({ data = [], height = 160, format = (v) => v }) {
  if (data.length === 0) return <Empty height={height} />;
  const max = Math.max(1, ...data.map((d) => Math.abs(Number(d.value) || 0)));
  return (
    <div style={{ height, display: "flex", gap: 8 }}>
      {data.map((d, i) => {
        const v = Number(d.value) || 0;
        const positive = v >= 0;
        const pct = (Math.abs(v) / max) * 100;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              {positive && (
                <div title={`${d.label}: ${v > 0 ? "+" : ""}${format(v)}`} style={{ width: "70%", margin: "0 auto", height: `${pct}%`, minHeight: v !== 0 ? 4 : 0, borderRadius: "5px 5px 2px 2px", background: "linear-gradient(180deg,#7fbf8f,#4f9e7a)", boxShadow: "0 2px 5px rgba(0,60,68,.2)" }} />
              )}
            </div>
            <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, padding: "2px 0", color: v > 0 ? "#166534" : v < 0 ? "#991b1b" : "var(--ink-soft)" }}>
              {v > 0 ? "+" : ""}{format(v)}
            </div>
            <div style={{ height: 1, background: "rgba(0,60,68,.25)" }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              {!positive && (
                <div title={`${d.label}: ${format(v)}`} style={{ width: "70%", margin: "0 auto", height: `${pct}%`, minHeight: v !== 0 ? 4 : 0, borderRadius: "2px 2px 5px 5px", background: "linear-gradient(0deg,#f87171,#dc2626)", boxShadow: "0 2px 5px rgba(0,60,68,.2)" }} />
              )}
            </div>
            <span style={{ fontSize: 10, color: "var(--ink-soft)", textAlign: "center", marginTop: 4 }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// Komponen: LineChart — garis + area untuk tren, dengan sumbu-Y berlabel & titik
// bulat di tiap data point. data: [{x(label), y(value)}]. viewBox skala seragam
// (tanpa distorsi) supaya lingkaran & teks tetap bulat/rapi.
const idFmt = (n) => Number(n || 0).toLocaleString("id-ID");
export function LineChart({ data = [] }) {
  if (data.length < 2) return <Empty height={160} />;
  const ys = data.map((d) => Number(d.y) || 0);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const range = max - min || 1;

  const VBW = 400; const VBH = 150;
  const padL = 46; const padR = 10; const padT = 12; const padB = 24;
  const plotW = VBW - padL - padR;
  const plotH = VBH - padT - padB;
  const xAt = (i) => padL + (i / (data.length - 1)) * plotW;
  const yAt = (v) => padT + (1 - (v - min) / range) * plotH;

  const pts = data.map((d, i) => [xAt(i), yAt(Number(d.y) || 0)]);
  const line = pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${padL},${padT + plotH} ${line} ${padL + plotW},${padT + plotH}`;
  const ticks = [max, (max + min) / 2, min];

  return (
    <svg viewBox={`0 0 ${VBW} ${VBH}`} width="100%" style={{ height: "auto", display: "block" }} role="img">
      <defs>
        <linearGradient id="lc-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4f9e7a" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#4f9e7a" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Gridline + angka sumbu-Y */}
      {ticks.map((t, i) => {
        const y = yAt(t);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={padL + plotW} y2={y} stroke="rgba(0,60,68,.12)" strokeWidth="1" />
            <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="var(--ink-soft)">{idFmt(Math.round(t))}</text>
          </g>
        );
      })}
      <polygon points={area} fill="url(#lc-area)" />
      <polyline points={line} fill="none" stroke="#006674" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {/* Titik bulat di tiap data point */}
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="#006674" stroke="#fff" strokeWidth="1.5" />
      ))}
      {/* Label tanggal awal & akhir */}
      <text x={padL} y={VBH - 7} fontSize="9" fill="var(--ink-soft)">{data[0].x}</text>
      <text x={padL + plotW} y={VBH - 7} textAnchor="end" fontSize="9" fill="var(--ink-soft)">{data[data.length - 1].x}</text>
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

// Komponen: Heatmap — grid hari × jam (follower aktif). heatmap: {wd:{hour:avg}}.
// wd: 0=Min..6=Sab (UTC). Intensitas warna teal mengikuti nilai/maks.
const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
export function Heatmap({ heatmap = {} }) {
  let max = 0;
  let best = null;
  for (const wd of Object.keys(heatmap)) {
    for (const h of Object.keys(heatmap[wd])) {
      const v = heatmap[wd][h] || 0;
      if (v > max) { max = v; best = { wd: Number(wd), h: Number(h), v }; }
    }
  }
  if (max <= 0) return <Empty height={160} />;

  // Jam puncak PER HARI (bukan cuma satu jam terbaik keseluruhan) — dasar tabel
  // rekomendasi upload per hari di sebelah heatmap.
  const perDayBest = DAYS.map((day, wd) => {
    const row = heatmap[wd];
    let bh = null;
    let bv = 0;
    if (row) {
      for (const h of Object.keys(row)) {
        const v = row[h] || 0;
        if (v > bv) { bv = v; bh = Number(h); }
      }
    }
    return { day, wd, hour: bh, value: bv };
  });

  return (
    <div>
      {/* Penjelasan */}
      <p className="mb-2 text-xs" style={{ color: "var(--ink-soft)" }}>
        Tiap kotak = satu jam pada satu hari. <b style={{ color: "var(--teal-900)" }}>Makin gelap = follower makin aktif</b> —
        jam-jam gelap paling bagus untuk posting.
      </p>
      {best && (
        <p className="mb-3 text-sm text-ink">
          <span className="font-semibold">⭐ Paling ramai: {DAYS[best.wd]} {String(best.h).padStart(2, "0")}:00</span> (~{Math.round(best.v)} follower aktif)
          <span style={{ color: "#8a5a12" }}> · 💡 disarankan upload ~{DAYS[best.wd]} {String((best.h + 23) % 24).padStart(2, "0")}:30</span>
        </p>
      )}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "separate", borderSpacing: 2 }}>
              <tbody>
                {DAYS.map((day, wd) => (
                  <tr key={wd}>
                    <td style={{ fontSize: 11, color: "var(--ink-soft)", paddingRight: 8, whiteSpace: "nowrap" }}>{day}</td>
                    {Array.from({ length: 24 }, (_, h) => {
                      const val = (heatmap[wd] && heatmap[wd][h]) || 0;
                      const a = val / max;
                      const isBest = best && best.wd === wd && best.h === h;
                      return (
                        <td
                          key={h}
                          title={`${day} ${String(h).padStart(2, "0")}:00 — ${Math.round(val)} follower aktif`}
                          style={{
                            width: 15, height: 15, borderRadius: 3, padding: 0,
                            background: `rgba(0,102,116,${0.06 + a * 0.94})`,
                            boxShadow: isBest ? "0 0 0 2px #f0b45a" : "none",
                          }}
                        />
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <td style={{ fontSize: 10, color: "var(--ink-soft)", paddingRight: 8 }}>Jam</td>
                  {Array.from({ length: 24 }, (_, h) => (
                    <td key={h} style={{ fontSize: 9, color: "var(--ink-soft)", textAlign: "center" }}>{h % 3 === 0 ? h : ""}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Legenda warna */}
          <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: "var(--ink-soft)" }}>
            <span>Sepi</span>
            <span style={{ width: 120, height: 10, borderRadius: 5, background: "linear-gradient(90deg, rgba(0,102,116,.08), rgba(0,102,116,1))", display: "inline-block" }} />
            <span>Ramai</span>
            <span className="ml-3 flex items-center gap-1"><span style={{ width: 10, height: 10, borderRadius: 3, boxShadow: "0 0 0 2px #f0b45a", display: "inline-block" }} /> jam terbaik</span>
          </div>
        </div>

        {/* Tabel rekomendasi upload per hari */}
        <div className="lg:w-60 lg:flex-shrink-0">
          <h4 className="mb-2 text-xs font-semibold" style={{ color: "var(--teal-900)" }}>📅 Rekomendasi upload per hari</h4>
          <div className="overflow-hidden rounded-xl" style={{ border: "1px solid rgba(0,60,68,.1)" }}>
            <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
              <thead style={{ background: "rgba(0,102,116,.07)" }}>
                <tr>
                  <th className="px-2 py-1.5 text-[10px] font-semibold text-ink">Hari</th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold text-ink">Puncak</th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold" style={{ color: "#8a5a12" }}>Upload</th>
                </tr>
              </thead>
              <tbody>
                {perDayBest.map((d) => (
                  <tr key={d.wd} className="border-t" style={{ borderColor: "rgba(0,60,68,.07)" }}>
                    <td className="px-2 py-1.5 text-xs font-medium text-ink">{d.day}</td>
                    {d.hour == null ? (
                      <td colSpan={2} className="px-2 py-1.5 text-[10px]" style={{ color: "var(--ink-soft)" }}>Belum ada data</td>
                    ) : (
                      <>
                        <td className="whitespace-nowrap px-2 py-1.5 text-xs">{String(d.hour).padStart(2, "0")}:00</td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-xs font-semibold" style={{ color: "#8a5a12" }}>{String((d.hour + 23) % 24).padStart(2, "0")}:30</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[10px]" style={{ color: "var(--ink-soft)" }}>
            Jam Puncak = follower paling aktif hari itu. Upload disarankan ~30 menit sebelumnya.
          </p>
        </div>
      </div>
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
