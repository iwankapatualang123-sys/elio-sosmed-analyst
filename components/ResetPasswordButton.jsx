// File: components/ResetPasswordButton.jsx
// Tombol "Reset Password" per user (admin, di Pengaturan). Generate password
// sementara BARU (Admin API) dan tampilkan sekali untuk dibagikan manual —
// dipakai saat password awal user terlewat/lupa.

"use client";

import { useActionState, useState } from "react";
import { resetUserPassword } from "@/app/settings/actions";
import Button from "@/components/Button";

export default function ResetPasswordButton({ userId, email }) {
  const [state, formAction, pending] = useActionState(resetUserPassword, null);
  const [copied, setCopied] = useState(false);

  function copyPassword() {
    if (!state?.tempPassword) return;
    navigator.clipboard.writeText(state.tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="inline-block">
      <form action={formAction} className="inline-block">
        <input type="hidden" name="id" value={userId} />
        <input type="hidden" name="email" value={email} />
        <Button type="submit" variant="ghost" disabled={pending} className="!min-h-0 !px-3 !py-1 text-xs">
          {pending ? "Memproses…" : "🔑 Reset Password"}
        </Button>
      </form>

      {state?.ok === false && (
        <p className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700" role="alert">{state.error}</p>
      )}
      {state?.ok === true && (
        <div className="mt-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs">
          <p className="text-ink">
            Password baru: <code className="rounded bg-white px-1.5 py-0.5 font-mono">{state.tempPassword}</code>{" "}
            <button type="button" onClick={copyPassword} className="font-semibold" style={{ color: "var(--teal-900)" }}>
              {copied ? "Tersalin ✓" : "Salin"}
            </button>
          </p>
          <p className="mt-0.5" style={{ color: "var(--ink-soft)" }}>Bagikan manual — tidak akan muncul lagi setelah ini.</p>
        </div>
      )}
    </div>
  );
}
