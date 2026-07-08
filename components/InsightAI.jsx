// File: components/InsightAI.jsx
// Tombol "ringkasan naratif" (client) — panggil /api/insights. Kalau Groq aktif
// hasilnya kalimat AI; kalau belum, tampilkan ringkasan formula + catatan.

"use client";

import { useState } from "react";
import Button from "@/components/Button";

export default function InsightAI({ accountId, namaCabang }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, namaCabang }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ error: "Gagal memuat ringkasan." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card-3d p-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-ink">Ringkasan Naratif</h3>
        <Button variant="primary" onClick={run} disabled={loading} className="!min-h-0 !px-3 !py-1.5 text-xs">
          {loading ? "Menyusun…" : "🤖 Buat ringkasan"}
        </Button>
      </div>
      {result && (
        <div className="mt-3">
          {result.error ? (
            <p className="text-sm text-red-600">{result.error}</p>
          ) : (
            <>
              <p className="text-sm text-ink">{result.narrative}</p>
              <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
                {result.source === "ai"
                  ? "✨ Disusun oleh AI (Groq)."
                  : "Ringkasan berbasis formula. Aktifkan AI dengan mengisi GROQ_API_KEY di server."}
                {result.warning ? ` (${result.warning})` : ""}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
