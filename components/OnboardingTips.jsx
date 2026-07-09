// File: components/OnboardingTips.jsx
// Kartu onboarding/tips singkat untuk user baru (blueprint 21D). Bisa ditutup;
// status simpan di localStorage agar tidak muncul lagi.

"use client";

import { useEffect, useState } from "react";

const KEY = "elio_onboarding_dismissed_v1";

const TIPS = [
  "Upload file export TikTok Studio (.zip) di menu Upload — bisa beberapa sekaligus.",
  "Lihat metrik, insight, & peringatan otomatis per cabang di Dashboard.",
  "Telusuri data mentah + filter bulan di menu Data; cari cepat lewat kotak pencarian.",
  "Set target di 'Target & Progress', beri konteks lewat 'Catatan/Anotasi'.",
  "Unduh laporan Excel/PDF per cabang maupun semua cabang.",
];

export default function OnboardingTips() {
  // "checking" -> hindari flicker & set-state-in-effect; render setelah tahu status.
  const [state, setState] = useState("checking"); // checking | show | hidden
  useEffect(() => {
    // Baca preferensi dari localStorage saat mount (hanya tersedia di client).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(localStorage.getItem(KEY) ? "hidden" : "show");
  }, []);
  if (state !== "show") return null;

  function dismiss() {
    localStorage.setItem(KEY, "1");
    setState("hidden");
  }

  return (
    <section className="card-3d p-4 sm:p-5">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-ink">👋 Selamat datang di Elio Analyst</h3>
        <button onClick={dismiss} className="ml-auto text-xs font-semibold" style={{ color: "var(--teal-900)" }}>Tutup ✕</button>
      </div>
      <ul className="ml-4 list-disc text-sm" style={{ color: "var(--ink-soft)" }}>
        {TIPS.map((t) => <li key={t} className="mb-0.5">{t}</li>)}
      </ul>
    </section>
  );
}
