// File: app/upload/page.jsx
// Halaman upload data TikTok (terproteksi). Server Component: baca profil user,
// tampilkan header + status role. Widget upload interaktif menyusul.

import { getCurrentProfile } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

export default async function UploadPage() {
  const profile = await getCurrentProfile();
  const hasRole = !!profile?.role;

  return (
    <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 p-6">
      <header className="card-3d flex items-center justify-between gap-4 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-ink">Upload Data TikTok</h1>
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            {profile?.email}
            {profile?.role ? ` · ${profile.role}` : " · belum ada role"}
          </p>
        </div>
        <LogoutButton />
      </header>

      {!hasRole ? (
        <section className="card-3d p-6">
          <h2 className="mb-2 text-base font-semibold text-ink">Akun belum diaktifkan</h2>
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            Akun Anda sudah login tapi belum punya profil/role di aplikasi ini.
            Hubungi admin untuk mengaktifkan akses cabang.
          </p>
        </section>
      ) : (
        <section className="card-3d p-6">
          <h2 className="mb-2 text-base font-semibold text-ink">Unggah file export TikTok Studio</h2>
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            Widget upload (pilih cabang, drag-and-drop zip/xlsx, progres) akan tampil di sini.
          </p>
        </section>
      )}
    </main>
  );
}
