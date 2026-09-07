// File: components/BranchAccessForm.jsx
// Form "Akses cabang" per user di Pengaturan (client) — memberi umpan balik
// Tersimpan/Gagal lewat useActionState, supaya admin tahu simpan berhasil (dulu
// tanpa indikator sehingga terasa "tidak berfungsi").

"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Button from "@/components/Button";
import { saveUserBranches } from "@/app/settings/actions";

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ghost" className="!min-h-0 !px-3 !py-1 text-xs" disabled={pending}>
      {pending ? "Menyimpan…" : "Simpan akses"}
    </Button>
  );
}

export default function BranchAccessForm({ userId, branches = [], assignedIds = [] }) {
  const assigned = new Set(assignedIds);
  const [state, formAction] = useActionState(saveUserBranches, null);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="userId" value={userId} />
      <span className="text-xs font-medium" style={{ color: "var(--ink-soft)" }}>Akses cabang:</span>
      {branches.map((b) => (
        <label key={b.id} className="flex items-center gap-1 text-xs text-ink">
          <input type="checkbox" name="branchIds" value={b.id} defaultChecked={assigned.has(b.id)} />
          {b.nama_cabang}
        </label>
      ))}
      {branches.length === 0 && <span className="text-xs" style={{ color: "var(--ink-soft)" }}>(belum ada cabang)</span>}
      <SaveBtn />
      {state?.ok && <span className="text-xs font-semibold" style={{ color: "#166534" }}>✓ Tersimpan ({state.count} cabang)</span>}
      {state && state.ok === false && <span className="text-xs font-semibold" style={{ color: "#b91c1c" }}>{state.error}</span>}
    </form>
  );
}
