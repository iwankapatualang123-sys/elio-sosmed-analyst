// File: components/ResetPasswordButton.jsx
// Reset password per user (admin, di Pengaturan). SEDERHANA: admin klik "Reset
// Password" → muncul kotak isian → ketik password baru manual → Simpan.
// Opsi "acak" tetap ada (kosongkan isian lalu klik Simpan, atau tombol Acak)
// untuk generate password sementara.

"use client";

import { useActionState, useState } from "react";
import { resetUserPassword } from "@/app/settings/actions";
import { copyToClipboard } from "@/lib/copyToClipboard";
import Button from "@/components/Button";

export default function ResetPasswordButton({ userId, email }) {
  const [state, formAction, pending] = useActionState(resetUserPassword, null);
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(null);

  async function copyPassword() {
    if (!state?.tempPassword) return;
    const ok = await copyToClipboard(state.tempPassword);
    setCopied(ok);
    setTimeout(() => setCopied(null), 2000);
  }

  if (!open) {
    return (
      <Button type="button" variant="ghost" onClick={() => setOpen(true)} className="!min-h-0 !px-3 !py-1 text-xs">
        🔑 Reset Password
      </Button>
    );
  }

  return (
    <div className="inline-block align-top">
      <form action={formAction} className="flex flex-wrap items-center gap-1.5">
        <input type="hidden" name="id" value={userId} />
        <input type="hidden" name="email" value={email} />
        <div className="relative">
          <input
            name="password"
            type={show ? "text" : "password"}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Password baru (min 8)"
            autoComplete="new-password"
            className="input-3d !min-h-0 !py-1 !pr-8 text-xs"
            style={{ width: 170 }}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs"
            style={{ color: "var(--ink-soft)" }}
            title={show ? "Sembunyikan" : "Tampilkan"}
            tabIndex={-1}
          >
            {show ? "🙈" : "👁"}
          </button>
        </div>
        <Button type="submit" variant="success" disabled={pending} className="!min-h-0 !px-3 !py-1 text-xs">
          {pending ? "…" : "Simpan"}
        </Button>
        <button type="button" onClick={() => { setOpen(false); setPw(""); }} className="text-xs" style={{ color: "var(--ink-soft)" }}>
          Batal
        </button>
      </form>

      <p className="mt-1 text-[10px]" style={{ color: "var(--ink-soft)" }}>
        Ketik password baru, atau kosongkan untuk buat password acak.
      </p>

      {state?.ok === false && (
        <p className="mt-1 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700" role="alert">{state.error}</p>
      )}
      {state?.ok === true && state.manual && (
        <p className="mt-1 rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-xs text-ink">
          ✓ Password <b>{state.email}</b> berhasil diperbarui.
        </p>
      )}
      {state?.ok === true && !state.manual && (
        <div className="mt-1 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs">
          <p className="text-ink">
            Password acak: <code className="select-all rounded bg-white px-1.5 py-0.5 font-mono">{state.tempPassword}</code>{" "}
            <button type="button" onClick={copyPassword} className="font-semibold" style={{ color: "var(--teal-900)" }}>
              {copied === true ? "Tersalin ✓" : copied === false ? "Blok manual" : "Salin"}
            </button>
          </p>
          <p className="mt-0.5" style={{ color: "var(--ink-soft)" }}>Bagikan manual — tidak muncul lagi setelah ini.</p>
        </div>
      )}
    </div>
  );
}
