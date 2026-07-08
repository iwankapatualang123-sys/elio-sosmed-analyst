// File: app/login/page.jsx
// Halaman login (email + password). Client component — pakai Supabase browser client.
// Bertema teal 3D (blueprint bagian 11 & 23).

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Button from "@/components/Button";
import PasswordInput from "@/components/PasswordInput";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fungsi: handleSubmit — proses login lalu arahkan ke /upload.
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError("Email atau password salah, atau akun belum aktif.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="relative z-10 flex min-h-screen items-center justify-center p-6">
      <div className="card-3d w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold text-white"
            style={{ background: "linear-gradient(180deg,#0a8291,#00545e)", boxShadow: "0 6px 14px rgba(0,59,67,.4), inset 0 1px 0 rgba(255,255,255,.4)" }}
          >
            Elio
          </div>
          <h1 className="text-xl font-semibold text-ink">Elio Sosmed Analyst</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
            Masuk untuk mengakses analitik TikTok
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              className="input-3d"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            Password
            <PasswordInput
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="mt-2 w-full">
            {loading ? "Memproses…" : "Masuk"}
          </Button>
        </form>
      </div>
    </main>
  );
}
