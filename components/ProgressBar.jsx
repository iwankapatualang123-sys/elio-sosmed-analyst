// File: components/ProgressBar.jsx
// Progress bar target vs pencapaian (blueprint 21A). Server-safe (tanpa hook).
// Input: { label, current, target, suffix?, format? }. Kalau target kosong,
// tampilkan "belum ada target".

const fmt = (n) => Number(n || 0).toLocaleString("id-ID");

export default function ProgressBar({ label, current = 0, target = null, suffix = "" }) {
  const hasTarget = target != null && Number(target) > 0;
  const pct = hasTarget ? Math.min(100, Math.round((Number(current) / Number(target)) * 100)) : 0;
  const done = pct >= 100;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-ink">{label}</span>
        <span style={{ color: "var(--ink-soft)" }}>
          {fmt(current)}{suffix} {hasTarget ? `/ ${fmt(target)}${suffix}` : ""}
          {hasTarget ? <b className="ml-1" style={{ color: done ? "#166534" : "var(--teal-900)" }}>{pct}%</b> : <span className="ml-1">· belum ada target</span>}
        </span>
      </div>
      <div style={{ height: 10, borderRadius: 6, background: "rgba(0,60,68,.1)", overflow: "hidden" }}>
        <div style={{
          width: `${hasTarget ? pct : 0}%`,
          height: "100%",
          borderRadius: 6,
          background: done ? "linear-gradient(90deg,#64b98f,#3d7f61)" : "linear-gradient(90deg,#0a8291,#006674)",
          transition: "width .3s ease",
        }} />
      </div>
    </div>
  );
}
