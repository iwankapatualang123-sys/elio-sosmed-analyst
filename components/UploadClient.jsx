// File: components/UploadClient.jsx
// Widget upload interaktif (client). Pilih cabang, drag-and-drop / browse file
// zip/xlsx, kirim ke /api/upload, tampilkan progres + ringkasan (blueprint 19 & 22).

"use client";

import { useRef, useState } from "react";
import Button from "@/components/Button";

// Label ramah untuk tiap jenis data (dipakai di ringkasan hasil).
const TYPE_LABEL = {
  content: "Konten",
  overview: "Overview harian",
  follower_history: "Riwayat follower",
  follower_gender: "Gender follower",
  follower_territories: "Lokasi follower",
  follower_activity: "Aktivitas follower",
  viewers: "Viewers",
};

// Fungsi: formatBytes — tampilkan ukuran file ringkas.
function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function UploadClient({ branches = [] }) {
  const [accountId, setAccountId] = useState(branches[0]?.id || "");
  const [files, setFiles] = useState([]); // File[]
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | sending | done | error
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef(null);

  const STEPS = ["Ekstrak arsip", "Baca data", "Simpan ke database", "Selesai"];

  const noBranch = branches.length === 0;

  // Fungsi: addFiles — tambah file (buang duplikat nama) ke daftar.
  function addFiles(list) {
    const incoming = Array.from(list);
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...incoming.filter((f) => !names.has(f.name))];
    });
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  }

  function removeFile(name) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }

  // Fungsi: handleSubmit — kirim file ke endpoint /api/upload.
  async function handleSubmit() {
    if (!accountId || files.length === 0) return;
    setStatus("sending");
    setStep(0);
    setErrorMsg("");
    setResult(null);
    // Indikator langkah (server memproses dalam 1 request; ini menandakan progres).
    const iv = setInterval(() => setStep((s) => Math.min(s + 1, 2)), 700);
    try {
      const form = new FormData();
      form.append("accountId", accountId);
      files.forEach((f) => form.append("files", f));
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      clearInterval(iv);
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error || "Gagal mengunggah.");
        return;
      }
      setStep(3);
      setResult(data);
      setStatus("done");
      setFiles([]);
    } catch (err) {
      clearInterval(iv);
      setStatus("error");
      setErrorMsg(err?.message || "Terjadi kesalahan jaringan.");
    }
  }

  return (
    <section className="card-3d p-6">
      <h2 className="mb-4 text-base font-semibold text-ink">Unggah file export TikTok Studio</h2>

      {/* Pilih cabang */}
      <label className="mb-4 flex flex-col gap-1.5 text-sm font-medium text-ink">
        Cabang / akun
        {noBranch ? (
          <span className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Belum ada cabang. Minta admin menambahkan cabang dulu.
          </span>
        ) : (
          <select className="input-3d" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nama_cabang} {b.tiktok_username ? `(@${b.tiktok_username})` : ""}
              </option>
            ))}
          </select>
        )}
      </label>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-colors"
        style={{
          borderColor: dragOver ? "var(--teal-700)" : "rgba(0,60,68,.2)",
          background: dragOver ? "rgba(0,102,116,.06)" : "rgba(244,250,245,.6)",
        }}
      >
        <div className="text-3xl">📁</div>
        <p className="text-sm font-medium text-ink">Tarik & lepas file di sini, atau klik untuk pilih</p>
        <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
          Mendukung .zip (dari TikTok Studio) dan .xlsx — bisa beberapa file sekaligus
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".zip,.xlsx"
          className="hidden"
          onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      {/* Daftar file terpilih */}
      {files.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {files.map((f) => (
            <li key={f.name} className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2 text-sm">
              <span className="truncate text-ink">{f.name}</span>
              <span className="ml-3 flex items-center gap-3">
                <span className="text-xs" style={{ color: "var(--ink-soft)" }}>{formatBytes(f.size)}</span>
                <button type="button" onClick={() => removeFile(f.name)} className="text-red-500 hover:text-red-700" aria-label="Hapus">✕</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Aksi */}
      <div className="mt-5 flex items-center gap-3">
        <Button variant="primary" disabled={noBranch || files.length === 0 || status === "sending"} onClick={handleSubmit}>
          {status === "sending" ? "Memproses…" : `Simpan ${files.length ? `(${files.length} file)` : ""}`}
        </Button>
      </div>

      {/* Step indicator saat memproses (blueprint 22) */}
      {status === "sending" && (
        <div className="mt-4">
          <div className="mb-2 h-2 overflow-hidden rounded-full" style={{ background: "rgba(0,60,68,.1)" }}>
            <div style={{ width: `${((step + 1) / STEPS.length) * 100}%`, height: "100%", background: "linear-gradient(90deg,#0a8291,#006674)", transition: "width .5s ease" }} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {STEPS.slice(0, 3).map((label, i) => (
              <span key={label} style={{ color: i <= step ? "var(--teal-900)" : "var(--ink-soft)", fontWeight: i === step ? 700 : 500 }}>
                {i < step ? "✓" : i === step ? "●" : "○"} {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{errorMsg}</p>
      )}

      {/* Hasil */}
      {status === "done" && result && <ResultSummary result={result} />}
    </section>
  );
}

// Komponen: ResultSummary — tampilkan ringkasan hasil upsert + peringatan.
function ResultSummary({ result }) {
  const t = result.totals || {};
  return (
    <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xl">✅</span>
        <p className="font-semibold text-ink">
          Selesai — {t.added} ditambah, {t.updated} diperbarui, {t.skipped} dilewati
          {t.failed ? `, ${t.failed} gagal` : ""}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr style={{ color: "var(--ink-soft)" }}>
              <th className="py-1 pr-3 font-medium">Jenis</th>
              <th className="py-1 pr-3 font-medium">Ditambah</th>
              <th className="py-1 pr-3 font-medium">Diperbarui</th>
              <th className="py-1 pr-3 font-medium">Dilewati</th>
            </tr>
          </thead>
          <tbody>
            {(result.perFile || []).map((f, i) => (
              <tr key={i} className="border-t border-green-100">
                <td className="py-1 pr-3 text-ink">{TYPE_LABEL[f.fileType] || f.filename || "?"}</td>
                <td className="py-1 pr-3">{f.added}</td>
                <td className="py-1 pr-3">{f.updated}</td>
                <td className="py-1 pr-3">{f.skipped}{f.error ? " ⚠️" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(result.warnings || []).length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-medium text-amber-800">Catatan:</p>
          <ul className="ml-4 list-disc text-xs" style={{ color: "var(--ink-soft)" }}>
            {result.warnings.slice(0, 8).map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
