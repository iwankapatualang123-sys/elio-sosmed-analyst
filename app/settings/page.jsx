// File: app/settings/page.jsx
// Halaman pengaturan (khusus admin): kelola cabang & user. Server Component +
// Server Actions (app/settings/actions.js). Blueprint bagian 21D & 20.

import { getCurrentProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import Button from "@/components/Button";
import { addBranch, toggleBranchActive, setUserRole, toggleUserActive, saveUserBranches } from "./actions";

export default async function SettingsPage() {
  const profile = await getCurrentProfile();

  if (profile?.role !== "admin") {
    return (
      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 p-6">
        <Nav email={profile?.email} role={profile?.role} />
        <section className="card-3d p-6">
          <h2 className="mb-2 text-base font-semibold text-ink">Akses ditolak</h2>
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Halaman ini hanya untuk admin.</p>
        </section>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: branches }, { data: users }, { data: access }] = await Promise.all([
    supabase.from("tiktok_accounts").select("*").order("nama_cabang"),
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("user_branch_access").select("user_id, tiktok_account_id"),
  ]);

  const accessByUser = new Map();
  for (const a of access || []) {
    if (!accessByUser.has(a.user_id)) accessByUser.set(a.user_id, new Set());
    accessByUser.get(a.user_id).add(a.tiktok_account_id);
  }
  const activeBranches = (branches || []).filter((b) => b.is_active);

  return (
    <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <Nav email={profile.email} role={profile.role} />

      {/* Cabang */}
      <section className="card-3d p-4 sm:p-6">
        <h2 className="mb-4 text-base font-semibold text-ink">Cabang / Akun TikTok</h2>

        <form action={addBranch} className="mb-5 grid gap-3 sm:grid-cols-4">
          <input name="nama_cabang" required placeholder="Nama cabang" className="input-3d" />
          <input name="tiktok_username" required placeholder="username (tanpa @)" className="input-3d" />
          <input name="kategori" placeholder="kategori (opsional)" className="input-3d" />
          <Button type="submit" variant="success">+ Tambah</Button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr style={{ color: "var(--ink-soft)" }}>
                <th className="py-2 pr-3 font-medium">Cabang</th>
                <th className="py-2 pr-3 font-medium">Username</th>
                <th className="py-2 pr-3 font-medium">Kategori</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {(branches || []).map((b) => (
                <tr key={b.id} className="border-t" style={{ borderColor: "rgba(0,60,68,.1)" }}>
                  <td className="py-2 pr-3 font-medium text-ink">{b.nama_cabang}</td>
                  <td className="py-2 pr-3">@{b.tiktok_username}</td>
                  <td className="py-2 pr-3">{b.kategori || "-"}</td>
                  <td className="py-2 pr-3">{b.is_active ? "Aktif" : "Nonaktif"}</td>
                  <td className="py-2 pr-3">
                    <form action={toggleBranchActive}>
                      <input type="hidden" name="id" value={b.id} />
                      <input type="hidden" name="next" value={String(!b.is_active)} />
                      <Button type="submit" variant="ghost" className="!min-h-0 !px-3 !py-1 text-xs">
                        {b.is_active ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
              {(branches || []).length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center" style={{ color: "var(--ink-soft)" }}>Belum ada cabang.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* User */}
      <section className="card-3d p-4 sm:p-6">
        <h2 className="mb-1 text-base font-semibold text-ink">User</h2>
        <p className="mb-4 text-xs" style={{ color: "var(--ink-soft)" }}>
          Akun baru dibuat lewat undangan di dashboard Supabase (Authentication). Setelah user
          login pertama, profilnya muncul di sini untuk diatur role & akses cabang.
        </p>

        <div className="flex flex-col gap-4">
          {(users || []).map((u) => {
            const assigned = accessByUser.get(u.id) || new Set();
            return (
              <div key={u.id} className="rounded-2xl border p-3" style={{ borderColor: "rgba(0,60,68,.12)", background: "rgba(255,255,255,.5)" }}>
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span className="font-medium text-ink">{u.full_name || u.email}</span>
                  <span className="text-xs" style={{ color: "var(--ink-soft)" }}>{u.email}</span>
                  <span className="ml-auto flex items-center gap-2">
                    <form action={setUserRole} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={u.id} />
                      <select name="role" defaultValue={u.role} className="input-3d !min-h-0 !py-1 text-xs">
                        <option value="admin">admin</option>
                        <option value="manager">manager</option>
                        <option value="staff">staff</option>
                      </select>
                      <Button type="submit" variant="ghost" className="!min-h-0 !px-3 !py-1 text-xs">Simpan role</Button>
                    </form>
                    <form action={toggleUserActive}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="next" value={String(!u.is_active)} />
                      <Button type="submit" variant="ghost" className="!min-h-0 !px-3 !py-1 text-xs">
                        {u.is_active ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                    </form>
                  </span>
                </div>

                {u.role === "admin" ? (
                  <p className="text-xs" style={{ color: "var(--ink-soft)" }}>Admin otomatis akses semua cabang.</p>
                ) : (
                  <form action={saveUserBranches} className="flex flex-wrap items-center gap-3">
                    <input type="hidden" name="userId" value={u.id} />
                    <span className="text-xs font-medium" style={{ color: "var(--ink-soft)" }}>Akses cabang:</span>
                    {activeBranches.map((b) => (
                      <label key={b.id} className="flex items-center gap-1 text-xs text-ink">
                        <input type="checkbox" name="branchIds" value={b.id} defaultChecked={assigned.has(b.id)} />
                        {b.nama_cabang}
                      </label>
                    ))}
                    {activeBranches.length === 0 && <span className="text-xs" style={{ color: "var(--ink-soft)" }}>(belum ada cabang)</span>}
                    <Button type="submit" variant="ghost" className="!min-h-0 !px-3 !py-1 text-xs">Simpan akses</Button>
                  </form>
                )}
              </div>
            );
          })}
          {(users || []).length === 0 && (
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Belum ada user.</p>
          )}
        </div>
      </section>
    </main>
  );
}
