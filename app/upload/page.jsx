// File: app/upload/page.jsx
// Halaman upload data TikTok (terproteksi). Server Component: baca profil user +
// daftar cabang (RLS), lalu render widget upload interaktif.

import { getCurrentProfile, canWrite } from "@/lib/auth";
import { createReadClient } from "@/lib/db-compat";
import Nav from "@/components/Nav";
import UploadClient from "@/components/UploadClient";
import SocialSnapshotCard from "@/components/SocialSnapshotCard";
import InstagramUploadCard from "@/components/InstagramUploadCard";
import { latestSnapshot } from "@/lib/social/snapshots";

export default async function UploadPage() {
  const profile = await getCurrentProfile();
  const hasRole = !!profile?.role;

  let branches = [];
  let latestSnaps = [];
  if (hasRole) {
    const supabase = await createReadClient(profile);
    const [{ data }, { data: snaps }] = await Promise.all([
      supabase
        .from("tiktok_accounts")
        .select("id, nama_cabang, tiktok_username")
        .eq("is_active", true)
        .order("nama_cabang"),
      supabase
        .from("social_account_snapshots")
        .select("tiktok_account_id, platform, snapshot_date, followers")
        .order("snapshot_date", { ascending: false })
        .limit(400),
    ]);
    branches = data || [];
    // Snapshot TERBARU per (cabang, platform) — untuk daftar "input terakhir".
    const byBranch = new Map();
    for (const b of branches) byBranch.set(b.id, b.nama_cabang);
    const perKey = new Map(); // `${acc}|${platform}` -> rows
    for (const s of snaps || []) {
      if (!byBranch.has(s.tiktok_account_id)) continue; // cabang diarsipkan dilewati
      const k = `${s.tiktok_account_id}|${s.platform}`;
      if (!perKey.has(k)) perKey.set(k, []);
      perKey.get(k).push(s);
    }
    latestSnaps = [...perKey.values()]
      .map((rows) => latestSnapshot(rows))
      .filter(Boolean)
      .map((s) => ({ accountId: s.tiktok_account_id, branch: byBranch.get(s.tiktok_account_id), platform: s.platform, snapshot_date: s.snapshot_date, followers: s.followers }))
      .sort((a, b) => a.branch.localeCompare(b.branch) || a.platform.localeCompare(b.platform));
  }

  return (
    <main className="relative z-10 mx-auto grid3 min-h-screen w-full max-w-3xl p-6">
      <Nav email={profile?.email} role={profile?.role} />

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
        <>
          <UploadClient branches={branches} />
          {/* Data IG dari export Meta Business Suite (harian + per konten). */}
          <InstagramUploadCard branches={branches} />
          {/* Snapshot manual mingguan IG/Threads (jangkar total follower) —
              tetap dipakai; file export IG hanya berisi PERTAMBAHAN follower. */}
          <SocialSnapshotCard branches={branches} latest={latestSnaps} />
        </>
      )}
    </main>
  );
}
