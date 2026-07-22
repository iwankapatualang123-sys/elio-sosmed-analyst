// File: app/account/page.jsx
// Halaman akun (terproteksi, semua role): ganti password sendiri.

import { getCurrentProfile } from "@/lib/auth";
import Nav from "@/components/Nav";
import ChangePasswordForm from "@/components/ChangePasswordForm";

export default async function AccountPage() {
  const profile = await getCurrentProfile();

  return (
    <main className="relative z-10 mx-auto grid3 min-h-screen w-full max-w-3xl p-4 sm:p-6">
      <Nav email={profile?.email} role={profile?.role} />
      <section className="card-3d p-6">
        <h1 className="mb-1 text-lg font-semibold text-ink">Akun Saya</h1>
        <p className="mb-5 text-sm" style={{ color: "var(--ink-soft)" }}>{profile?.email}</p>
        <h2 className="mb-3 text-base font-semibold text-ink">Ganti Password</h2>
        <ChangePasswordForm />
      </section>
    </main>
  );
}
