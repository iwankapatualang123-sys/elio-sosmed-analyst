// File: app/settings/page.jsx
// Halaman pengaturan (khusus admin): kelola cabang & user. Server Component +
// Server Actions (app/settings/actions.js). Blueprint bagian 21D & 20.

import { getCurrentProfile } from "@/lib/auth";
import { createReadClient } from "@/lib/db-compat";
import Nav from "@/components/Nav";
import Button from "@/components/Button";
import InviteUserForm from "@/components/InviteUserForm";
import BranchRow from "@/components/BranchRow";
import GoalManager from "@/components/GoalManager";
import SettingsTabs from "@/components/SettingsTabs";
import UserCard from "@/components/UserCard";
import { addBranch, addCategory, deleteCategory } from "./actions";

const CATEGORY_TYPE_LABEL = { pic: "PIC", goals: "Goals Content", pillar: "Pillar", type: "Type of Content" };

// Header kartu seragam: ikon + judul + deskripsi + aksi opsional (kanan).
function CardHead({ icon, title, desc, action = null }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-base" style={{ background: "var(--pri-50)", color: "var(--teal-900)" }} aria-hidden>{icon}</span>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {desc && <p className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--ink-soft)" }}>{desc}</p>}
      </div>
      {action && <div className="ml-auto flex-shrink-0">{action}</div>}
    </div>
  );
}

export default async function SettingsPage() {
  const profile = await getCurrentProfile();

  if (profile?.role !== "admin") {
    return (
      <main className="relative z-10 mx-auto grid3 min-h-screen w-full max-w-5xl p-6">
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
    <main className="relative z-10 mx-auto grid3 min-h-screen w-full max-w-5xl p-4 sm:p-6">
      <Nav email={profile.email} role={profile.role} />

      <div className="px-1">
        <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">Pengaturan</h1>
        <p className="mt-0.5 text-sm" style={{ color: "var(--on-bg-soft)" }}>Kelola outlet, tim &amp; akses, konfigurasi konten, dan backup — dalam tab terpisah.</p>
      </div>

      <SettingsTabs tabs={[{ icon: "🏪", label: "Outlet" }, { icon: "👥", label: "Tim & Akses" }, { icon: "🗂️", label: "Rencana Konten" }, { icon: "💾", label: "Data" }]}>
        {/* ───── TAB: OUTLET ───── */}
        <div className="flex flex-col gap-4">
          <section className="card-3d p-4 sm:p-6">
            <CardHead icon="🏪" title="Outlet" desc="Daftar outlet lintas platform (TikTok / Instagram / Threads). Tambah, edit, atau nonaktifkan di sini." />
            <form action={addBranch} className="mb-5 grid gap-3 rounded-xl p-3 sm:grid-cols-4" style={{ background: "var(--pri-50)" }}>
              <input name="nama_cabang" required placeholder="Nama outlet" className="input-3d" />
              <input name="tiktok_username" required placeholder="username TikTok (tanpa @)" className="input-3d" />
              <input name="kategori" placeholder="kategori (opsional)" className="input-3d" />
              <Button type="submit" variant="success">+ Tambah outlet</Button>
            </form>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr style={{ color: "var(--ink-soft)" }}>
                    <th className="py-2 pr-3 font-medium">Outlet</th>
                    <th className="py-2 pr-3 font-medium">Username TikTok</th>
                    <th className="py-2 pr-3 font-medium">Kategori</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {(branches || []).map((b) => <BranchRow key={b.id} branch={b} />)}
                  {(branches || []).length === 0 && (
                    <tr><td colSpan={5} className="py-4 text-center" style={{ color: "var(--ink-soft)" }}>Belum ada outlet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card-3d p-4 sm:p-6">
            <CardHead icon="🎯" title="Target per Outlet & Platform" desc="Pilih Bulan, Outlet, dan Platform, lalu isi target (Views, Engagement Rate, Net Follower). Tiap kombinasi punya targetnya sendiri; progres tampil di Ringkasan Platform di Dashboard. Kosongkan kolom yang tidak ditarget." />
            <GoalManager branches={activeBranches} goalMap={goalMap} monthOptions={monthOptions} />
          </section>
        </div>

        {/* ───── TAB: TIM & AKSES ───── */}
        <div className="flex flex-col gap-4">
          <section className="card-3d p-4 sm:p-6">
            <CardHead icon="＋" title="Tambah User" desc="Buat akun baru — role &amp; akses cabang bisa diatur setelahnya." />
            <InviteUserForm />
          </section>

          <section className="card-3d p-4 sm:p-6">
            <CardHead icon="👥" title={`Daftar User (${(users || []).length})`} desc="Atur role, status, akses cabang, dan reset password tiap anggota tim." />
            <div className="flex flex-col gap-3">
              {(users || []).map((u) => (
                <UserCard key={u.id} user={u} branches={activeBranches} assignedIds={[...(accessByUser.get(u.id) || new Set())]} />
              ))}
              {(users || []).length === 0 && (
                <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Belum ada user.</p>
              )}
            </div>
          </section>
        </div>

        {/* ───── TAB: RENCANA KONTEN ───── */}
        <div>
          <section className="card-3d p-4 sm:p-6">
            <CardHead icon="🗂️" title="Kategori Rencana Konten" desc="Pilihan dropdown PIC, Goals Content, Pillar, dan Type of Content di halaman Rencana Konten. Tambah nilai baru bila ada PIC/kategori baru." />
            <form action={addCategory} className="mb-5 grid gap-3 rounded-xl p-3 sm:grid-cols-4" style={{ background: "var(--pri-50)" }}>
              <select name="category_type" required className="input-3d" defaultValue="">
                <option value="" disabled>Jenis kategori</option>
                {Object.entries(CATEGORY_TYPE_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
              <input name="value" required placeholder="Nilai baru, mis. Video" className="input-3d sm:col-span-2" />
              <Button type="submit" variant="success">+ Tambah</Button>
            </form>
            <div className="grid gap-4 sm:grid-cols-2">
              {Object.entries(CATEGORY_TYPE_LABEL).map(([type, label]) => (
                <div key={type} className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}>
                  <h3 className="mb-2 text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>{label}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {categoriesByType[type].length === 0 && (
                      <span className="text-xs" style={{ color: "var(--ink-soft)" }}>Belum ada nilai.</span>
                    )}
                    {categoriesByType[type].map((c) => (
                      <form key={c.id} action={deleteCategory} className="inline-flex items-center gap-1 rounded-full py-1 pl-3 pr-1.5 text-xs font-medium" style={{ background: "rgba(91,99,235,.08)", color: "var(--teal-900)" }}>
                        <input type="hidden" name="id" value={c.id} />
                        {c.value}
                        <button type="submit" className="rounded-full px-1 hover:bg-[rgba(16,24,40,.12)]" title={`Hapus "${c.value}"`}>×</button>
                      </form>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ───── TAB: DATA ───── */}
        <div>
          <section className="card-3d p-4 sm:p-6">
            <CardHead
              icon="💾"
              title="Backup Data"
              desc="Unduh seluruh data ke satu file Excel (penting untuk paket tanpa backup otomatis). Simpan berkala di penyimpananmu sendiri."
              action={<a href="/api/report/backup"><Button variant="success">⬇️ Backup (.xlsx)</Button></a>}
            />
          </section>
        </div>
      </SettingsTabs>
    </main>
  );
}
