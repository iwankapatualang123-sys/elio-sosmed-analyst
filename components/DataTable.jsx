// File: components/DataTable.jsx
// Tabel reusable interaktif (client): search, sort (klik header), pagination
// (baris/halaman + maju-mundur + info), sticky header, scroll horizontal, empty
// state. Sebagian fitur komponen tabel standar blueprint bagian 20 (search/sort/
// pagination); column visibility, download & clickable row menyusul.
//
// Kolom pakai TIPE FORMAT serializable (bukan fungsi) supaya bisa dioper dari
// Server Component: columns [{ key, label, align?, format? }].
//   format: 'number' | 'pct' | 'date' | 'diff' | 'er' | 'hour' | 'incomplete' | 'text'

"use client";

import { useMemo, useState } from "react";

const fmt = (n) => Number(n || 0).toLocaleString("id-ID");

function erValue(row) {
  const views = Number(row.total_views) || 0;
  const eng = (Number(row.total_likes) || 0) + (Number(row.total_comments) || 0) + (Number(row.total_shares) || 0);
  return views > 0 ? (eng / views) * 100 : 0;
}

// Render isi sel sesuai format kolom.
function cellContent(row, col) {
  const v = row[col.key];
  switch (col.format) {
    case "number": {
      const neg = Number(v) < 0;
      return <span style={neg ? { color: "#b91c1c", fontWeight: 600 } : undefined}>{fmt(v)}</span>;
    }
    case "pct":
      return v == null ? "-" : `${Number(v)}%`;
    case "diff": {
      const d = Number(v) || 0;
      return <span style={{ color: d > 0 ? "#166534" : d < 0 ? "#b91c1c" : undefined }}>{d > 0 ? `+${fmt(d)}` : fmt(d)}</span>;
    }
    case "er":
      return `${Math.round(erValue(row) * 100) / 100}%`;
    case "hour":
      return `${String(v).padStart(2, "0")}:00`;
    case "incomplete":
      return row.is_incomplete
        ? <span className="text-amber-700">⚠️ Belum lengkap</span>
        : <span style={{ color: "var(--ink-soft)" }}>Lengkap</span>;
    case "text":
      return <span className="line-clamp-1 block max-w-xs" title={String(v ?? "")}>{v ?? "-"}</span>;
    default:
      return v ?? "-";
  }
}

// Nilai untuk sorting (angka untuk numerik, string lowercase untuk teks).
function sortValue(row, col) {
  if (col.format === "er") return erValue(row);
  if (["number", "pct", "diff", "hour"].includes(col.format)) return Number(row[col.key]) || 0;
  return String(row[col.key] ?? "").toLowerCase();
}

export default function DataTable({ columns = [], rows = [], emptyText = "Tidak ada data.", maxHeight = 380 }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(0);

  const processed = useMemo(() => {
    let r = rows;
    const q = query.trim().toLowerCase();
    if (q) {
      r = r.filter((row) => columns.map((c) => String(row[c.key] ?? "")).join(" ").toLowerCase().includes(q));
    }
    if (sort.key) {
      const col = columns.find((c) => c.key === sort.key);
      r = [...r].sort((a, b) => {
        const av = sortValue(a, col);
        const bv = sortValue(b, col);
        if (av < bv) return sort.dir === "asc" ? -1 : 1;
        if (av > bv) return sort.dir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return r;
  }, [rows, columns, query, sort]);

  const total = processed.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const cur = Math.min(page, pages - 1);
  const start = cur * pageSize;
  const pageRows = processed.slice(start, start + pageSize);

  function toggleSort(key) {
    setPage(0);
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input
          className="input-3d !min-h-0 !py-1.5 max-w-xs"
          placeholder="Cari…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(0); }}
        />
        <label className="ml-auto flex items-center gap-1 text-xs" style={{ color: "var(--ink-soft)" }}>
          Baris/hal:
          <select
            className="input-3d !min-h-0 !py-1 !px-2 text-xs"
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
          >
            {[20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      {/* Tabel */}
      <div className="overflow-auto rounded-xl" style={{ maxHeight, border: "1px solid rgba(0,60,68,.1)" }}>
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10" style={{ background: "linear-gradient(180deg,#eaf5ec,#dcefe0)" }}>
            <tr>
              {columns.map((c) => {
                const active = sort.key === c.key;
                return (
                  <th
                    key={c.key}
                    onClick={() => toggleSort(c.key)}
                    className="cursor-pointer select-none whitespace-nowrap px-3 py-2 font-semibold text-ink hover:bg-white/40"
                    style={{ textAlign: c.align || "left" }}
                    title="Klik untuk urutkan"
                  >
                    {c.label}
                    <span style={{ opacity: active ? 1 : 0.25 }}> {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-3 py-6 text-center" style={{ color: "var(--ink-soft)" }}>{emptyText}</td></tr>
            ) : (
              pageRows.map((row, i) => (
                <tr key={i} className="border-t" style={{ borderColor: "rgba(0,60,68,.08)" }}>
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 py-1.5 text-ink" style={{ textAlign: c.align || "left" }}>
                      {cellContent(row, c)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination info */}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--ink-soft)" }}>
        <span>
          {total === 0 ? "0 data" : `Menampilkan ${start + 1}–${Math.min(start + pageSize, total)} dari ${total}`}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => setPage(Math.max(0, cur - 1))} disabled={cur === 0}
            className="rounded-lg border px-2 py-1 disabled:opacity-40" style={{ borderColor: "rgba(0,60,68,.2)" }}>← Sebelumnya</button>
          <span className="px-1">Hal {cur + 1}/{pages}</span>
          <button type="button" onClick={() => setPage(Math.min(pages - 1, cur + 1))} disabled={cur >= pages - 1}
            className="rounded-lg border px-2 py-1 disabled:opacity-40" style={{ borderColor: "rgba(0,60,68,.2)" }}>Berikutnya →</button>
        </div>
      </div>
    </div>
  );
}
