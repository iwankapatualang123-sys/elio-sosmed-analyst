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
    <form onSubmit={submit} className="relative w-full md:w-auto">
      <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-soft)" }} aria-hidden />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari cabang / video…"
        aria-label="Pencarian global"
        className="w-full rounded-full py-1.5 pl-8 pr-3 text-sm outline-none md:w-[190px]"
        style={{ background: "#f4f6fb", border: "1px solid var(--line)", color: "var(--ink)", minWidth: 0 }}
      />
    </form>
  );
}
