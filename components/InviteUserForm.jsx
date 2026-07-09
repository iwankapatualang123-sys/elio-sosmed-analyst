// File: components/InviteUserForm.jsx
// Form "Undang User" (admin, di halaman Pengaturan). Buat akun langsung lewat
// Server Action inviteUser (Admin API) dan tampilkan password sementara untuk
// dibagikan manual — tidak bergantung pengiriman email undangan.

"use client";

import { useActionState, useState } from "react";
import { inviteUser } from "@/app/settings/actions";
import { copyToClipboard } from "@/lib/copyToClipboard";
import Button from "@/components/Button";

export default function InviteUserForm() {
  const [state, formAction, pending] = useActionState(inviteUser, null);
  const [copied, setCopied] = useState(null); // null | true | false

  async function copyPassword() {
    if (!state?.tempPassword) return;
    const ok = await copyToClipboard(state.tempPassword);
    setCopied(ok);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div>
      <form action={formAction} className="grid gap-2 sm:grid-cols-4">
        <input name="email" type="email" required placeholder="Email user baru" className="input-3d !min-h-0 !py-1.5 text-sm" />
        <input name="full_name" placeholder="Nama (opsional)" className="input-3d !min-h-0 !py-1.5 text-sm" />
        <select name="role" defaultValue="staff" className="input-3d !min-h-0 !py-1.5 text-sm">
          <option value="staff">staff</option>
          <option value="manager">manager</option>
          <option value="admin">admin</option>
        </select>
        <Button type="submit" variant="success" disabled={pending} className="!min-h-0 !py-1.5 text-sm">
          {pending ? "Membuat…" : "+ Undang User"}
        </Button>
      </form>

      {state?.ok === false && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{state.error}</p>
      )}

      {state?.ok === true && (
        <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm">
          <p className="font-semibold text-ink">✅ Akun dibuat: {state.email}</p>
          <p className="mt-1 text-ink">
            Password sementara: <code className="select-all rounded bg-white px-2 py-0.5 font-mono" title="Klik untuk blok teks, lalu Ctrl+C kalau tombol Salin tidak berfungsi">{state.tempPassword}</code>{" "}
            <button type="button" onClick={copyPassword} className="text-xs font-semibold" style={{ color: "var(--teal-900)" }}>
              {copied === true ? "Tersalin ✓" : copied === false ? "Gagal, blok teks manual" : "Salin"}
            </button>
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
            Bagikan manual ke user ini (WA/email) — password ini tidak disimpan lagi setelah Anda tinggalkan halaman ini.
            Minta mereka login lalu ganti password di menu Akun. (Kalau tombol Salin gagal, klik teks password untuk blok lalu Ctrl+C.)
          </p>
        </div>
      )}
    </div>
  );
}
