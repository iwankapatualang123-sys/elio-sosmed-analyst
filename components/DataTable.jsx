// File: components/DataTable.jsx
// Tabel reusable sederhana (server-safe). Header sticky, scroll horizontal, empty
// state. Versi ringan dari komponen tabel standar (blueprint bagian 20) — fitur
// lanjutan (search, sort, pagination) menyusul.
// Input: columns [{ key, label, align?, render? }], rows, emptyText, maxHeight.

const fmt = (n) => Number(n || 0).toLocaleString("id-ID");

export default function DataTable({ columns = [], rows = [], emptyText = "Tidak ada data.", maxHeight = 360 }) {
  return (
    <div className="overflow-auto rounded-xl" style={{ maxHeight, border: "1px solid rgba(0,60,68,.1)" }}>
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 z-10" style={{ background: "linear-gradient(180deg,#eaf5ec,#dcefe0)" }}>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="whitespace-nowrap px-3 py-2 font-semibold text-ink" style={{ textAlign: c.align || "left" }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center" style={{ color: "var(--ink-soft)" }}>
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="border-t" style={{ borderColor: "rgba(0,60,68,.08)" }}>
                {columns.map((c) => (
                  <td key={c.key} className="px-3 py-1.5 text-ink" style={{ textAlign: c.align || "left" }}>
                    {c.render ? c.render(row) : (typeof row[c.key] === "number" ? fmt(row[c.key]) : (row[c.key] ?? "-"))}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
