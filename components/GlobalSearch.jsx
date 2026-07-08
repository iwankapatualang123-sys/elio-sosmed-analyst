// File: components/GlobalSearch.jsx
// Kotak pencarian global (client) di header — cari cabang/video, submit -> /search?q=
// (blueprint 21E).

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export default function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function submit(e) {
    e.preventDefault();
    const t = q.trim();
    if (t) router.push(`/search?q=${encodeURIComponent(t)}`);
  }

  return (
    <form onSubmit={submit} className="relative">
      <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,.6)" }} aria-hidden />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari cabang / video…"
        aria-label="Pencarian global"
        className="rounded-full py-1.5 pl-8 pr-3 text-sm text-white outline-none placeholder:text-white/50"
        style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.18)", minWidth: 170 }}
      />
    </form>
  );
}
