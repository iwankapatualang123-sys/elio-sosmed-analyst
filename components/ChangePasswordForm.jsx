// File: components/ChangePasswordForm.jsx
// Form ganti password (client). Pakai sesi login aktif (tanpa perlu password lama
// / email), via supabase.auth.updateUser. Untuk mengganti password sementara admin.

"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Button from "@/components/Button";
import PasswordInput from "@/components/PasswordInput";

export default function ChangePasswordForm() {
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // { type:'ok'|'err', text }

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg(null);
    if (pass.length < 8) return setMsg({ type: "err", text: "Password minimal 8 karakter." });
    if (pass !== confirm) return setMsg({ type: "err", text: "Konfirmasi password tidak cocok." });
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: pass });
    setLoading(false);
    if (error) return setMsg({ type: "err", text: `Gagal: ${error.message}` });
    setPass("");
    setConfirm("");
    setMsg({ type: "ok", text: "Password berhasil diganti. Pakai password baru saat login berikutnya." });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        Password baru
        <PasswordInput value={pass} onChange={(e) => setPass(e.target.value)} placeholder="min. 8 karakter" autoComplete="new-password" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        Ulangi password baru
        <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
      </label>
      {msg && (
        <p className={`rounded-lg px-3 py-2 text-sm ${msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`} role="alert">
          {msg.text}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={loading}>
        {loading ? "Menyimpan…" : "Ganti password"}
      </Button>
    </form>
  );
}
