// File: app/upload/page.jsx
// Halaman upload data TikTok (terproteksi). Server Component: baca profil user +
// daftar cabang (RLS), lalu render widget upload interaktif.

import { getCurrentProfile, canWrite } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";
import UploadClient from "@/components/UploadClient";

export default async function UploadPage() {
  const profile = await getCurrentProfile();
  const hasRole = !!profile?.role;

  let branches = [];
  if (hasRole) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("tiktok_accounts")
      .select("id, nama_cabang, tiktok_username")
      .eq("is_active", true)
      .order("nama_cabang");
    branches = data || [];
  }

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
      ) : !canWrite(profile) ? (
        <section className="card-3d p-6">
          <h2 className="mb-2 text-base font-semibold text-ink">Akses baca saja</h2>
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            Role <b>{profile.role}</b> tidak bisa mengunggah data. Hanya admin & manager
            yang boleh menyimpan data (staff hanya melihat).
          </p>
        </section>
      ) : (
        <UploadClient branches={branches} />
      )}
    </main>
  );
}
