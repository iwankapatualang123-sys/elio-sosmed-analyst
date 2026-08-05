// File: components/MetricCard.jsx
// Kartu KPI bergaya referensi UI: latar PASTEL lembut per-aspek + chip ikon
// berwarna solid + angka besar. Server-safe (tanpa hook).
// Input: { icon, label, value, sub, accent }. accent: indigo|green|blue|amber|
// orange|violet (alias lama: teal→indigo).

const ACCENTS = {
  indigo: { bg: "#eef0fe", chip: "#5b63eb", ring: "#e0e3fb" },
  teal:   { bg: "#eef0fe", chip: "#5b63eb", ring: "#e0e3fb" }, // alias lama
  green:  { bg: "#e7f9f0", chip: "#12b76a", ring: "#cdefdd" },
  blue:   { bg: "#eaf4ff", chip: "#53b1fd", ring: "#d5e9ff" },
  sky:    { bg: "#eaf4ff", chip: "#53b1fd", ring: "#d5e9ff" },
  amber:  { bg: "#fff7e6", chip: "#f5b445", ring: "#fde9bf" },
  orange: { bg: "#fff3ec", chip: "#f79066", ring: "#ffdcc9" },
  violet: { bg: "#f3f0fe", chip: "#9b8afb", ring: "#e6e0fd" },
};

export default function MetricCard({ icon = "•", label, value, sub, accent = "indigo", chip = null }) {
  const a = ACCENTS[accent] || ACCENTS.indigo;
  return (
    <div
      className="relative flex flex-col gap-2.5 rounded-2xl p-4"
      style={{ background: a.bg, border: `1px solid ${a.ring}` }}
    >
      {chip != null && (
        <span
          className="absolute right-3 top-3 rounded-full px-2 py-0.5 text-[9.5px] font-bold"
          style={{ background: a.ring, color: a.chip }}
        >
          {chip}
        </span>
      )}
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl text-base text-white"
        style={{ background: a.chip, boxShadow: `0 4px 10px -3px ${a.chip}80` }}
      >
        {icon}
      </div>
      <div className="text-2xl font-bold leading-tight text-ink">{value}</div>
      <div className="text-[13px] font-medium" style={{ color: "var(--ink-soft)" }}>{label}</div>
      {sub != null && <div className="text-xs" style={{ color: "var(--ink-soft)" }}>{sub}</div>}
    </div>
  );
}
