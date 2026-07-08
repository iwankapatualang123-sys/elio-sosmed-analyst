// File: components/PasswordInput.jsx
// Input password dengan tombol "mata" untuk lihat/sembunyikan isi (client).
// Reusable — dipakai di login & ganti password. Meneruskan semua props ke <input>.

"use client";

import { useState } from "react";

export default function PasswordInput({ className = "", ...props }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative block">
      <input
        type={show ? "text" : "password"}
        className={`input-3d pr-12 ${className}`}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
        title={show ? "Sembunyikan" : "Tampilkan"}
        className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-base"
        style={{ color: "var(--ink-soft)" }}
      >
        {show ? "🙈" : "👁️"}
      </button>
    </span>
  );
}
