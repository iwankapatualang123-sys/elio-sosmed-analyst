// File: components/MetricCard.jsx
// Kartu metrik 3D dengan chip ikon berwarna per aspek (blueprint bagian 23).
// Server-safe (tanpa hook). Input: { icon, label, value, sub, accent }.

const ACCENTS = {
  teal: "linear-gradient(180deg,#0a8291,#00545e)",
  green: "linear-gradient(180deg,#64b98f,#3d7f61)",
  blue: "linear-gradient(180deg,#4b8fd6,#2c5f9e)",
  amber: "linear-gradient(180deg,#f0b45a,#c8822a)",
};

export default function MetricCard({ icon = "•", label, value, sub, accent = "teal" }) {
  return (
    <div className="card-3d flex flex-col gap-2 p-4">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl text-lg text-white"
        style={{ background: ACCENTS[accent] || ACCENTS.teal, boxShadow: "0 4px 8px rgba(0,60,68,.25), inset 0 1px 0 rgba(255,255,255,.35)" }}
      >
        {icon}
      </div>
      <div className="text-2xl font-bold leading-tight text-ink">{value}</div>
      <div className="text-sm" style={{ color: "var(--ink-soft)" }}>{label}</div>
      {sub != null && <div className="text-xs" style={{ color: "var(--ink-soft)" }}>{sub}</div>}
    </div>
  );
}
