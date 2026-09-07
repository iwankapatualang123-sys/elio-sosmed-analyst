// File: components/UserCard.jsx
// Kartu user di Pengaturan (client), ringkas & aman:
//  - MODE BACA (default): satu baris — avatar, nama, badge role/status, ringkasan
//    akses, tombol "Edit". Tak ada tombol berbahaya yang mudah terpencet.
//  - MODE EDIT: SATU formulir dengan SATU tombol "Simpan perubahan" yang menyimpan
//    role + akses cabang sekaligus (saveUserSettings). Nonaktifkan & Reset Password
//    adalah aksi akun terpisah (bukan bagian formulir).

"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Button from "@/components/Button";
import ResetPasswordButton from "@/components/ResetPasswordButton";
import { saveUserSettings, toggleUserActive } from "@/app/settings/actions";

const ROLE_BADGE = {
  admin: { background: "#1a2338", color: "#fff" },
  manager: { background: "#fff3e9", color: "#b5651d" },
  staff: { background: "#eef0fe", color: "#3f46c9" },
};

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" className="!min-h-0 !px-4 !py-1.5 text-xs" disabled={pending}>
      {pending ? "Menyimpan…" : "Simpan perubahan"}
    </Button>
  );
}

export default function UserCard({ user, branches = [], assignedIds = [] }) {
  const u = user;
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState(u.role);
  const [sel, setSel] = useState(() => new Set(assignedIds));
  const [state, formAction] = useActionState(saveUserSettings, null);

  const initial = (u.full_name || u.email || "?").charAt(0).toUpperCase();
  const roleStyle = ROLE_BADGE[role] || ROLE_BADGE.staff;
  const assignedNames = branches.filter((b) => assignedIds.includes(b.id)).map((b) => b.nama_cabang);
  const toggle = (id) => setSel((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const StatusPill = ({ active }) => (
    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={active ? { background: "#e7f9f0", color: "#0f9d58" } : { background: "#f0f1f6", color: "#667085" }}>{active ? "aktif" : "nonaktif"}</span>
  );

  return (
    <div className="rounded-xl border p-3" style={{ borderColor: editing ? "#c7cdfb" : "var(--line)", background: editing ? "var(--pri-50)" : "#fff" }}>
      {/* Header ringkas */}
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white" style={{ background: "linear-gradient(160deg,#a5b4fc,#6b73f0 55%,#3730a3)" }}>{initial}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-semibold text-ink">{u.full_name || u.email}</span>
            <span className="rounded-full px-2 py-0.5 text-[9.5px] font-bold capitalize" style={roleStyle}>{role}</span>
            <StatusPill active={u.is_active} />
          </div>
          <div className="truncate text-[11.5px]" style={{ color: "var(--ink-soft)" }}>
            {u.email}
            {!editing && (u.role === "admin"
              ? " · Akses: semua cabang"
              : assignedNames.length ? ` · Akses: ${assignedNames.length} cabang — ${assignedNames.join(", ")}` : " · Belum ada akses cabang")}
          </div>
        </div>
        <Button type="button" variant={editing ? "primary" : "ghost"} onClick={() => setEditing((e) => !e)} className="!min-h-0 flex-shrink-0 !px-3.5 !py-1.5 text-xs">
          {editing ? "Tutup" : "✏️ Edit"}
        </Button>
      </div>

      {/* Panel edit — SATU formulir, SATU tombol simpan (role + akses) */}
      {editing && (
        <div className="mt-3 border-t border-dashed pt-3" style={{ borderColor: "#c7cdfb" }}>
          <form action={formAction} className="flex flex-col gap-3">
            <input type="hidden" name="userId" value={u.id} />
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Role</label>
              <select name="role" value={role} onChange={(e) => setRole(e.target.value)} className="input-3d !min-h-0 !py-1 text-xs">
                <option value="admin">admin</option>
                <option value="manager">manager</option>
                <option value="staff">staff</option>
              </select>
            </div>

            {role === "admin" ? (
              <p className="text-xs" style={{ color: "var(--ink-soft)" }}>Admin otomatis mengakses semua cabang.</p>
            ) : (
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Akses cabang</p>
                <div className="flex flex-wrap gap-2">
                  {branches.map((b) => {
                    const on = sel.has(b.id);
                    return (
                      <label key={b.id} className="inline-flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] transition-colors"
                        style={on ? { background: "#fff", border: "1px solid #c7cdfb", color: "var(--teal-900)", fontWeight: 600 } : { background: "#fff", border: "1px solid var(--line)", color: "var(--ink)" }}>
                        <input type="checkbox" name="branchIds" value={b.id} checked={on} onChange={() => toggle(b.id)} className="sr-only" />
                        <span className="flex h-3.5 w-3.5 items-center justify-center rounded text-[10px] text-white" style={on ? { background: "var(--pri)" } : { border: "1.5px solid #b8bfd6" }}>{on ? "✓" : ""}</span>
                        {b.nama_cabang}
                      </label>
                    );
                  })}
                  {branches.length === 0 && <span className="text-xs" style={{ color: "var(--ink-soft)" }}>(belum ada cabang)</span>}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <SaveBtn />
              {state?.ok && <span className="text-xs font-semibold" style={{ color: "#166534" }}>✓ Tersimpan</span>}
              {state && state.ok === false && <span className="text-xs font-semibold" style={{ color: "#b91c1c" }}>{state.error}</span>}
            </div>
          </form>

          {/* Aksi akun (di luar formulir) */}
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: "rgba(16,24,40,.08)" }}>
            <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Akun</span>
            <form action={toggleUserActive}>
              <input type="hidden" name="id" value={u.id} />
              <input type="hidden" name="next" value={String(!u.is_active)} />
              <Button type="submit" variant={u.is_active ? "danger" : "ghost"} className="!min-h-0 !px-3 !py-1 text-xs">{u.is_active ? "Nonaktifkan" : "Aktifkan"}</Button>
            </form>
            <ResetPasswordButton userId={u.id} email={u.email} />
          </div>
        </div>
      )}
    </div>
  );
}
