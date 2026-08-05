// File: components/umum/UmumCatFilter.jsx
// Filter KATEGORI outlet (Internal / Eksternal) untuk halaman Umum — segmented
// control. Mengubah komposisi outlet yang diringkas, jadi lewat URL (?cat=) supaya
// dihitung ulang di server. Parameter lain (month) dipertahankan.

"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

export default function UmumCatFilter({ categories = [], value = null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(cat) {
    const params = new URLSearchParams(searchParams.toString());
    if (!cat) params.delete("cat");
    else params.set("cat", cat);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const opts = [{ key: null, label: "Semua" }, ...categories.map((c) => ({ key: c, label: c }))];

  return (
    <div className="inline-flex items-center rounded-full p-1" style={{ background: "#f1f2f7", border: "1px solid var(--line)" }}>
      {opts.map((o) => {
        const on = (value || null) === o.key;
        return (
          <button
            key={o.label}
            type="button"
            onClick={() => go(o.key)}
            className="rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all"
            style={on
              ? { background: "#fff", color: "var(--teal-900)", boxShadow: "0 1px 3px rgba(16,24,40,.14)" }
              : { background: "transparent", color: "var(--ink-soft)" }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
