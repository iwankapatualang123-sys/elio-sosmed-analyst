// File: components/UserCard.jsx
// Kartu user di Pengaturan (client) dengan MODE EDIT: default tampil ringkas
// (baca-saja) supaya tidak ada tombol berbahaya (Reset/Nonaktifkan) yang mudah
// terpencet. Klik "Edit" untuk memunculkan semua kontrol, "Tutup" untuk kembali.

"use client";

import { useState } from "react";
import Button from "@/components/Button";
import ResetPasswordButton from "@/components/ResetPasswordButton";
import BranchAccessForm from "@/components/BranchAccessForm";
import { setUserRole, toggleUserActive } from "@/app/settings/actions";

const ROLE_BADGE = {
  admin: { background: "#1a2338", color: "#fff" },
  manager: { background: "#fff3e9", color: "#b5651d" },
  staff: { background: "#eef0fe", color: "#3f46c9" },
};

export default function UserCard({ user, branches = [], assignedIds = [] }) {
  const [editing, setEditing] = useState(false);
  const u = user;
  const initial = (u.full_name || u.email || "?").charAt(0).toUpperCase();
  const roleStyle = ROLE_BADGE[u.role] || ROLE_BADGE.staff;
  const isAdmin = u.role === "admin";
  const assignedNames = branches.filter((b) => assignedIds.includes(b.id)).map((b) => b.nama_cabang);

  return (
    <div className="rounded-2xl border p-3.5" style={{ borderColor: editing ? "#c7cdfb" : "var(--line)", background: editing ? "var(--pri-50)" : "#fff" }}>
      {/* Header ringkas — selalu tampil */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: "linear-gradient(160deg,#a5b4fc,#6b73f0 55%,#3730a3)" }}>{initial}</span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{u.full_name || u.email}</span>
            <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold capitalize" style={roleStyle}>{u.role}</span>
            <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={u.is_active ? { background: "#e7f9f0", color: "#0f9d58" } : { background: "#f0f1f6", color: "#667085" }}>{u.is_active ? "aktif" : "nonaktif"}</span>
          </div>
          {u.full_name && <div className="text-xs" style={{ color: "var(--ink-soft)" }}>{u.email}</div>}
        </div>
        <div className="ml-auto">
          <Button type="button" variant={editing ? "primary" : "ghost"} onClick={() => setEditing((e) => !e)} className="!min-h-0 !px-3.5 !py-1.5 text-xs">
            {editing ? "Tutup" : "✏️ Edit"}
          </Button>
        </div>
      </div>

      {/* Ringkasan akses (mode baca) */}
      {!editing && (
        <div className="mt-3 border-t border-dashed pt-2.5" style={{ borderColor: "var(--line)" }}>
          <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Akses cabang: </span>
          <span className="text-xs" style={{ color: "var(--ink-soft)" }}>
            {isAdmin
              ? "Semua cabang (admin)."
              : assignedNames.length
                ? `${assignedNames.length} cabang — ${assignedNames.join(", ")}`
                : "Belum ada akses cabang."}
          </span>
        </div>
      )}

      {/* Panel edit — hanya muncul saat Edit diklik */}
      {editing && (
        <div className="mt-3 flex flex-col gap-3 border-t border-dashed pt-3" style={{ borderColor: "#c7cdfb" }}>
          <div className="flex flex-wrap items-center gap-2">
            <form action={setUserRole} className="flex items-center gap-1">
              <input type="hidden" name="id" value={u.id} />
              <select name="role" defaultValue={u.role} className="input-3d !min-h-0 !py-1 text-xs">
                <option value="admin">admin</option>
                <option value="manager">manager</option>
                <option value="staff">staff</option>
              </select>
              <Button type="submit" variant="ghost" className="!min-h-0 !px-3 !py-1 text-xs">Simpan role</Button>
            </form>
            <form action={toggleUserActive}>
              <input type="hidden" name="id" value={u.id} />
              <input type="hidden" name="next" value={String(!u.is_active)} />
              <Button type="submit" variant={u.is_active ? "danger" : "ghost"} className="!min-h-0 !px-3 !py-1 text-xs">{u.is_active ? "Nonaktifkan" : "Aktifkan"}</Button>
            </form>
            <ResetPasswordButton userId={u.id} email={u.email} />
          </div>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Akses cabang</p>
            {isAdmin ? (
              <p className="text-xs" style={{ color: "var(--ink-soft)" }}>Admin otomatis mengakses semua cabang.</p>
            ) : (
              <BranchAccessForm userId={u.id} branches={branches} assignedIds={assignedIds} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
