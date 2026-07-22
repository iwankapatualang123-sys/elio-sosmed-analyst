// File: app/settings/page.jsx
// Halaman pengaturan (khusus admin): kelola cabang & user. Server Component +
// Server Actions (app/settings/actions.js). Blueprint bagian 21D & 20.

import { getCurrentProfile } from "@/lib/auth";
import { createReadClient } from "@/lib/db-compat";
import Nav from "@/components/Nav";
import Button from "@/components/Button";
import InviteUserForm from "@/components/InviteUserForm";
import ResetPasswordButton from "@/components/ResetPasswordButton";
import BranchRow from "@/components/BranchRow";
import GoalManager from "@/components/GoalManager";
import { addBranch, setUserRole, toggleUserActive, saveUserBranches, addCategory, deleteCategory } from "./actions";

const CATEGORY_TYPE_LABEL = { pic: "PIC", goals: "Goals Content", pillar: "Pillar", type: "Type of Content" };

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

  const supabase = await createReadClient(profile);
  const [{ data: branches }, { data: users }, { data: access }, { data: categoriesRaw }, { data: goals }] = await Promise.all([
    supabase.from("tiktok_accounts").select("*").order("nama_cabang"),
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("user_branch_access").select("user_id, tiktok_account_id"),
    supabase.from("content_plan_categories").select("*").order("value"),
    supabase.from("tiktok_account_goals").select("tiktok_account_id, platform, target_month, target_total_views, target_engagement_rate, target_net_followers"),
  ]);
  // Peta target: `${accountId}|${platform}|${month}` -> row (prefill GoalManager).
  const goalMap = {};
  for (const g of goals || []) goalMap[`${g.tiktok_account_id}|${g.platform}|${g.target_month}`] = g;
  // Pilihan bulan: 12 bulan ke belakang s/d 1 bulan ke depan (terbaru dulu) +
  // bulan yang sudah punya target (kalau di luar rentang) — supaya tetap bisa diedit.
  const now = new Date();
  const monthSet = new Set();
  for (let i = -1; i <= 12; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  for (const g of goals || []) if (g.target_month) monthSet.add(g.target_month);
  const monthOptions = [...monthSet].sort().reverse();

  const accessByUser = new Map();
  for (const a of access || []) {
    if (!accessByUser.has(a.user_id)) accessByUser.set(a.user_id, new Set());
    accessByUser.get(a.user_id).add(a.tiktok_account_id);
  }
  const activeBranches = (branches || []).filter((b) => b.is_active);

  // Kelompokkan kategori Rencana Konten per tipe untuk ditampilkan sbg chip.
  const categoriesByType = { pic: [], goals: [], pillar: [], type: [] };
  for (const c of categoriesRaw || []) {
    if (categoriesByType[c.category_type]) categoriesByType[c.category_type].push(c);
  }

  return (
    <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <Nav email={profile.email} role={profile.role} />

      {/* Backup */}
      <section className="card-3d flex flex-wrap items-center gap-3 p-4 sm:p-5">
        <div>
          <h2 className="text-base font-semibold text-ink">Backup Data</h2>
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Unduh seluruh data ke satu file Excel (penting untuk paket Free tanpa backup otomatis).</p>
        </div>
        <a href="/api/report/backup" className="ml-auto"><Button variant="success">⬇️ Backup semua data (.xlsx)</Button></a>
      </section>

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
                <BranchRow key={b.id} branch={b} />
              ))}
              {(branches || []).length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center" style={{ color: "var(--ink-soft)" }}>Belum ada cabang.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Target per Cabang & Platform */}
      <section className="card-3d p-4 sm:p-6">
        <h2 className="mb-1 text-base font-semibold text-ink">🎯 Target per Cabang & Platform</h2>
        <p className="mb-4 text-sm" style={{ color: "var(--ink-soft)" }}>
          Pilih <b>Bulan</b>, <b>Outlet</b>, dan <b>Platform</b>, lalu isi target (Views, Engagement Rate, Net Follower) dan klik Simpan. Setiap kombinasi bulan/outlet/platform punya targetnya sendiri. Progress-nya tampil di <b>Ringkasan Platform</b> di Dashboard (ikut filter bulan; tanpa filter = bulan berjalan). Kosongkan kolom yang tidak ingin ditarget.
        </p>
        <GoalManager branches={activeBranches} goalMap={goalMap} monthOptions={monthOptions} />
      </section>

      {/* Kategori Rencana Konten */}
      <section className="card-3d p-4 sm:p-6">
        <h2 className="mb-1 text-base font-semibold text-ink">Kategori Rencana Konten</h2>
        <p className="mb-4 text-xs" style={{ color: "var(--ink-soft)" }}>
          Pilihan dropdown PIC, Goals Content, Pillar, dan Type of Content di halaman Rencana Konten. Tambah nilai baru di sini kalau ada PIC/kategori baru.
        </p>

        <form action={addCategory} className="mb-5 grid gap-3 sm:grid-cols-4">
          <select name="category_type" required className="input-3d" defaultValue="">
            <option value="" disabled>Jenis kategori</option>
            {Object.entries(CATEGORY_TYPE_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <input name="value" required placeholder="Nilai baru, mis. Video" className="input-3d sm:col-span-2" />
          <Button type="submit" variant="success">+ Tambah</Button>
        </form>

        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(CATEGORY_TYPE_LABEL).map(([type, label]) => (
            <div key={type}>
              <h3 className="mb-2 text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>{label}</h3>
              <div className="flex flex-wrap gap-1.5">
                {categoriesByType[type].length === 0 && (
                  <span className="text-xs" style={{ color: "var(--ink-soft)" }}>Belum ada nilai.</span>
                )}
                {categoriesByType[type].map((c) => (
                  <form key={c.id} action={deleteCategory} className="inline-flex items-center gap-1 rounded-full py-1 pl-3 pr-1.5 text-xs font-medium" style={{ background: "rgba(0,102,116,.08)", color: "var(--teal-900)" }}>
                    <input type="hidden" name="id" value={c.id} />
                    {c.value}
                    <button type="submit" className="rounded-full px-1 hover:bg-[rgba(0,60,68,.12)]" title={`Hapus "${c.value}"`}>×</button>
                  </form>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* User */}
      <section className="card-3d p-4 sm:p-6">
        <h2 className="mb-1 text-base font-semibold text-ink">User</h2>
        <p className="mb-3 text-xs" style={{ color: "var(--ink-soft)" }}>
          Buat akun user baru di bawah ini (role bisa diubah lagi kapan saja), atau atur role/akses cabang user yang sudah ada.
        </p>
        <div className="mb-5 border-b pb-4" style={{ borderColor: "rgba(0,60,68,.1)" }}>
          <InviteUserForm />
        </div>

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
                    <ResetPasswordButton userId={u.id} email={u.email} />
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
