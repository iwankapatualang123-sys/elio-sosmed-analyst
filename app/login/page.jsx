// File: app/login/page.jsx
// Halaman login (email + password). Client component — pakai Supabase browser client.
// Bertema teal 3D (blueprint bagian 11 & 23). Pesan error spesifik per penyebab
// (bukan generik) + baca alasan redirect dari middleware (mis. akun dinonaktifkan).

"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Button from "@/components/Button";
import PasswordInput from "@/components/PasswordInput";

// Pesan untuk redirect paksa dari middleware (?reason=...).
const REASON_MESSAGES = {
  nonaktif: "Akun Anda telah dinonaktifkan oleh admin. Hubungi admin untuk info lebih lanjut.",
};

// Fungsi: describeAuthError — ubah error Supabase Auth jadi pesan spesifik Bahasa
// Indonesia. "Invalid login credentials" sengaja tidak dipecah jadi "email salah"
// vs "password salah" (Supabase memang menyamakan keduanya agar email tidak bisa
// ditebak/di-enumerasi oleh pihak luar).
function describeAuthError(err) {
  const msg = (err?.message || "").toLowerCase();
  if (msg.includes("invalid login credentials")) {
    return "Email atau password salah. Periksa kembali, atau minta admin reset password Anda (menu Pengaturan).";
  }
  if (msg.includes("email not confirmed")) {
    return "Email belum dikonfirmasi. Hubungi admin.";
  }
  if (err?.status === 429 || msg.includes("rate limit") || msg.includes("security purposes")) {
    return "Terlalu banyak percobaan login dalam waktu singkat. Coba lagi sebentar lagi.";
  }
  if (msg.includes("user not found")) {
    return "Akun dengan email ini tidak ditemukan.";
  }
  return err?.message || "Gagal masuk. Coba lagi.";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(reason ? (REASON_MESSAGES[reason] || "") : "");

  // Fungsi: handleSubmit — login, cek akun masih aktif, lalu arahkan ke /dashboard.
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createSupabaseBrowserClient();

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(describeAuthError(signInError));
        setLoading(false);
        return;
      }

      // Login Supabase berhasil bukan berarti akun boleh dipakai — cek status aktif
      // (bisa dinonaktifkan admin) sebelum masuk, supaya pesannya jelas di sini.
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", user.id).maybeSingle();
      if (profile && profile.is_active === false) {
        await supabase.auth.signOut();
        setError(REASON_MESSAGES.nonaktif);
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Gagal terhubung ke server. Periksa koneksi internet Anda lalu coba lagi.");
      setLoading(false);
    }
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

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
