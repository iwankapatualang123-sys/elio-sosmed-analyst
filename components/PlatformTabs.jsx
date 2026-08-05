// File: components/PlatformTabs.jsx
// Tab pilihan platform (client) utk panel Ringkasan Platform di Dashboard.
// Anak-anak (children) dirender SEMUA di server (data sudah siap), di sini hanya
// dipilih mana yang tampil — tanpa fetch ulang, ganti tab instan.

"use client";

import { useState } from "react";

export default function PlatformTabs({ tabs = [], children }) {
  const [active, setActive] = useState(0);
  const kids = Array.isArray(children) ? children : [children];
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {tabs.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setActive(i)}
            className="rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all"
            style={i === active
              ? { background: "linear-gradient(180deg,#6b73f0,#5b63eb)", color: "#fff", boxShadow: "0 4px 10px -3px rgba(16,24,40,.4)" }
              : { background: "rgba(91,99,235,.08)", color: "var(--teal-900)" }}
          >
            {label}
          </button>
        ))}
      </div>
      {kids.map((k, i) => (
        <div key={i} style={{ display: i === active ? "block" : "none" }}>{k}</div>
      ))}
    </div>
  );
}
