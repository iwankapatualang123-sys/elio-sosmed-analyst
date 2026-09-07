// File: components/BranchAccessForm.jsx
// Form "Akses cabang" per user di Pengaturan (client). Cabang ditampilkan sebagai
// CHIP yang bisa diklik (bukan checkbox mentah). Umpan balik Tersimpan/Gagal lewat
// useActionState supaya admin tahu simpan berhasil.

"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Button from "@/components/Button";
import { saveUserBranches } from "@/app/settings/actions";

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" className="!min-h-0 !px-3.5 !py-1.5 text-xs" disabled={pending}>
      {pending ? "Menyimpan…" : "Simpan akses"}
    </Button>
  );
}

export default function BranchAccessForm({ userId, branches = [], assignedIds = [] }) {
  const [sel, setSel] = useState(() => new Set(assignedIds));
  const [state, formAction] = useActionState(saveUserBranches, null);
  const toggle = (id) => setSel((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      {branches.map((b) => {
        const on = sel.has(b.id);
        return (
          <label
            key={b.id}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] transition-colors"
            style={on
              ? { background: "var(--pri-50)", border: "1px solid #c7cdfb", color: "var(--teal-900)", fontWeight: 600 }
              : { background: "#f8f9fc", border: "1px solid var(--line)", color: "var(--ink)" }}
          >
            <input type="checkbox" name="branchIds" value={b.id} checked={on} onChange={() => toggle(b.id)} className="sr-only" />
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded text-[10px] text-white" style={on ? { background: "var(--pri)" } : { border: "1.5px solid #b8bfd6" }}>{on ? "✓" : ""}</span>
            {b.nama_cabang}
          </label>
        );
      })}
      {branches.length === 0 && <span className="text-xs" style={{ color: "var(--ink-soft)" }}>(belum ada cabang)</span>}
      <SaveBtn />
      {state?.ok && <span className="text-xs font-semibold" style={{ color: "#166534" }}>✓ Tersimpan ({state.count} cabang)</span>}
      {state && state.ok === false && <span className="text-xs font-semibold" style={{ color: "#b91c1c" }}>{state.error}</span>}
    </form>
  );
}
