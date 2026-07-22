// File: app/activity/page.jsx
// Halaman Log Aktivitas (khusus admin): audit trail siapa melakukan apa & kapan
// (blueprint bagian 21B). Membaca activity_log (RLS: admin-only read).

import { getCurrentProfile } from "@/lib/auth";
import { createReadClient } from "@/lib/db-compat";
import Nav from "@/components/Nav";
import DataTable from "@/components/DataTable";

// Label ramah untuk kode aksi.
const ACTION_LABEL = {
  upload_data: "Upload data",
  tambah_cabang: "Tambah cabang",
  aktifkan_cabang: "Aktifkan cabang",
  nonaktifkan_cabang: "Nonaktifkan cabang",
  ubah_role_user: "Ubah role user",
  aktifkan_user: "Aktifkan user",
  nonaktifkan_user: "Nonaktifkan user",
  ubah_akses_cabang: "Ubah akses cabang",
};

export default async function ActivityPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") {
    return (
      <main className="relative z-10 mx-auto grid3 min-h-screen w-full max-w-6xl p-6">
        <Nav email={profile?.email} role={profile?.role} />
        <section className="card-3d p-6">
          <h2 className="mb-2 text-base font-semibold text-ink">Akses ditolak</h2>
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Log aktivitas hanya untuk admin.</p>
        </section>
      </main>
    );
  }

  const supabase = await createReadClient(profile);
  const { data } = await supabase
    .from("activity_log").select("*").order("created_at", { ascending: false }).limit(1000);

  const rows = (data || []).map((r) => ({
    waktu: new Date(r.created_at).toLocaleString("id-ID"),
    user: r.user_email || "-",
    aksi: ACTION_LABEL[r.action] || r.action,
    entity: r.entity || "-",
    detail: r.detail ? JSON.stringify(r.detail) : "-",
  }));

  return (
    <main className="relative z-10 mx-auto grid3 min-h-screen w-full max-w-6xl p-4 sm:p-6">
      <Nav email={profile.email} role={profile.role} />
      <div className="px-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink drop-shadow-sm sm:text-3xl">Log Aktivitas</h1>
        <p className="mt-0.5 text-sm" style={{ color: "var(--ink-soft)" }}>
          Jejak audit: siapa mengunggah/mengubah apa & kapan
        </p>
      </div>

      <section className="card-3d p-4 sm:p-5">
        <DataTable
          rows={rows}
          emptyText="Belum ada aktivitas tercatat."
          maxHeight={560}
          columns={[
            { key: "waktu", label: "Waktu" },
            { key: "user", label: "User" },
            { key: "aksi", label: "Aksi" },
            { key: "entity", label: "Objek" },
            { key: "detail", label: "Detail", format: "text" },
          ]}
        />
      </section>
    </main>
  );
}
