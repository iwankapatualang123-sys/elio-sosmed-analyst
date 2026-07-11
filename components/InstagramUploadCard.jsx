// File: components/InstagramUploadCard.jsx
// Kartu upload export Instagram (Meta Business Suite) di halaman Upload —
// Tahap A laporan IG. Terima BANYAK file sekaligus (harian + per konten
// dicampur boleh); jenis tiap file dideteksi otomatis di server. Hasil per
// file ditampilkan satu-satu supaya file yang gagal jelas alasannya.

"use client";

import { useState } from "react";
import { AtSign, UploadCloud, CheckCircle2, XCircle } from "lucide-react";
import { uploadInstagramFiles } from "@/app/upload/actions";

// Label ramah untuk jenis/metrik hasil parse.
const METRIC_LABEL = {
  views: "Tayangan harian",
  reach: "Jangkauan harian",
  profile_visits: "Kunjungan profil harian",
  new_followers: "Pengikut baru harian",
  interactions: "Interaksi harian",
};

export default function InstagramUploadCard({ branches = [] }) {
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null); // [{name, ok, ...}] | null
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    if (busy || files.length === 0) return;
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const fd = new FormData(e.currentTarget);
      for (const f of files) fd.append("files", f);
      const res = await uploadInstagramFiles(fd);
      setResults(res.results);
      setFiles([]); // reset pilihan supaya tidak terkirim dobel tanpa sengaja
      e.target.reset?.();
    } catch (err) {
      setError(err?.message || "Gagal meng-upload.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card-3d p-5 sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <AtSign size={18} style={{ color: "var(--teal-900)" }} />
        <h2 className="text-base font-semibold text-ink">Upload data Instagram (Business Suite)</h2>
      </div>
      <p className="mb-4 text-sm" style={{ color: "var(--ink-soft)" }}>
        Export dari <b>Meta Business Suite → Insights</b>: file harian (Tayangan, Jangkauan, Kunjungan
        Profil, Pengikut) dan file <b>per konten</b> (Konten → Export data). Pilih semua file-nya
        sekaligus — jenis tiap file dikenali otomatis. Upload ulang aman: tanggal/konten yang sama
        diperbarui, tidak dobel.
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm sm:max-w-xs">
          <span className="font-semibold text-ink">Cabang</span>
          <select name="accountId" className="input-3d" required>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.nama_cabang}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">File CSV (boleh banyak sekaligus)</span>
          <input
            type="file"
            accept=".csv"
            multiple
            disabled={busy}
            onChange={(e) => setFiles([...(e.target.files || [])])}
            className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[rgba(0,102,116,.1)] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[var(--teal-900)]"
          />
          {files.length > 0 && (
            <span className="text-[11px]" style={{ color: "var(--ink-soft)" }}>
              {files.length} file dipilih: {files.map((f) => f.name).join(", ")}
            </span>
          )}
        </label>

        {error && (
          <div className="rounded-xl p-3 text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c" }}>
            <b>Gagal:</b> {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={busy || files.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "linear-gradient(180deg,#0a8291,#006674)" }}
          >
            <UploadCloud size={16} /> {busy ? "Memproses…" : `Upload ${files.length > 0 ? files.length + " file" : ""}`}
          </button>
        </div>
      </form>

      {/* Hasil per file */}
      {results && (
        <ul className="mt-3 space-y-1.5 border-t pt-3 text-[13px]" style={{ borderColor: "rgba(0,60,68,.1)" }}>
          {results.map((r, i) => (
            <li key={i} className="flex items-start gap-2">
              {r.ok ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" style={{ color: "#166534" }} /> : <XCircle size={15} className="mt-0.5 shrink-0 text-red-600" />}
              <span className="min-w-0">
                <b className="text-ink">{r.name}</b>{" "}
                {r.ok ? (
                  r.kind === "daily" ? (
                    <span style={{ color: "var(--ink-soft)" }}>
                      → {METRIC_LABEL[r.metric] || r.metricLabel} · {r.rows} hari ({r.from} s/d {r.to})
                    </span>
                  ) : (
                    <span style={{ color: "var(--ink-soft)" }}>
                      → data per konten · {r.rows} konten{r.collab > 0 ? ` (${r.collab} kolaborasi akun lain)` : ""}
                    </span>
                  )
                ) : (
                  <span style={{ color: "#b91c1c" }}>→ {r.error}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
