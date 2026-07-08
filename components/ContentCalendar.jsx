// File: components/ContentCalendar.jsx
// Kalender bulanan konten (blueprint 21A): tiap hari menampilkan jumlah video +
// total views. Server-safe (props). dayData: { [dayNumber]: { count, views, titles[] } }.

const DOW = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const fmt = (n) => Number(n || 0).toLocaleString("id-ID");

export default function ContentCalendar({ year, month, dayData = {} }) {
  // month: 1-12. Hari pertama & jumlah hari (pakai UTC agar konsisten).
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const maxViews = Math.max(1, ...Object.values(dayData).map((x) => x.views || 0));

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
        {DOW.map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const info = dayData[d];
          const intensity = info ? 0.12 + (info.views / maxViews) * 0.55 : 0;
          return (
            <div
              key={i}
              title={info ? `${info.count} video · ${fmt(info.views)} views\n${(info.titles || []).join("\n")}` : ""}
              className="flex min-h-[64px] flex-col rounded-lg p-1.5 text-xs"
              style={{ background: info ? `rgba(0,102,116,${intensity})` : "rgba(255,255,255,.45)", border: "1px solid rgba(0,60,68,.08)" }}
            >
              <span className="font-semibold" style={{ color: info && intensity > 0.4 ? "#fff" : "var(--ink)" }}>{d}</span>
              {info && (
                <span className="mt-auto leading-tight" style={{ color: intensity > 0.4 ? "#fff" : "var(--ink-soft)" }}>
                  {info.count}🎬<br />{fmt(info.views)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
