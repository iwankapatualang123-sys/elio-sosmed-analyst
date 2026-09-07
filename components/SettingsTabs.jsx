// File: components/SettingsTabs.jsx
// Tab untuk halaman Pengaturan (client). Semua panel dirender di server & dioper
// sebagai children; komponen ini hanya memilih mana yang tampil (ganti instan).

"use client";

import { useState } from "react";

export default function SettingsTabs({ tabs = [], children }) {
  const [active, setActive] = useState(0);
  const kids = Array.isArray(children) ? children : [children];
  return (
    <div>
      <div className="mb-5 inline-flex flex-wrap gap-1 rounded-2xl p-1.5" style={{ background: "#fff", border: "1px solid var(--line)", boxShadow: "0 1px 2px rgba(16,24,40,.04)" }}>
        {tabs.map((t, i) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setActive(i)}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all"
            style={i === active
              ? { background: "linear-gradient(180deg,#6b73f0,#5b63eb)", color: "#fff", boxShadow: "0 4px 10px -3px rgba(91,99,235,.5)" }
              : { background: "transparent", color: "var(--ink-soft)" }}
          >
            <span aria-hidden>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>
      {kids.map((k, i) => (
        <div key={i} style={{ display: i === active ? "block" : "none" }}>{k}</div>
      ))}
    </div>
  );
}
