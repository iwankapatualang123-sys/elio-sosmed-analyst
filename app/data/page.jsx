// File: app/data/page.jsx
// Halaman "Data" (terproteksi): tampilkan data mentah yang sudah diupload per aspek
// (Konten, Overview, Follower, Gender, Lokasi, Aktivitas, Viewers) dalam tabel,
// dengan filter cabang + bulan. Blueprint bagian 20 & 21A.

import { getCurrentProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import DataFilters from "@/components/DataFilters";
import DataTable from "@/components/DataTable";

const fmt = (n) => Number(n || 0).toLocaleString("id-ID");
const monthOf = (d) => (typeof d === "string" ? d.slice(0, 7) : null);
const pct = (v) => (v == null ? "-" : `${Number(v)}%`);

// ER per baris konten (DB tidak menyimpannya).
function erOf(r) {
  const views = Number(r.total_views) || 0;
  const eng = (Number(r.total_likes) || 0) + (Number(r.total_comments) || 0) + (Number(r.total_shares) || 0);
  return views > 0 ? `${Math.round((eng / views) * 10000) / 100}%` : "0%";
}
// Angka merah kalau negatif (anomali TikTok).
function numCell(r, key) {
  const neg = Number(r[key]) < 0;
  return <span style={neg ? { color: "#b91c1c", fontWeight: 600 } : undefined}>{fmt(r[key])}</span>;
}

export default async function DataPage({ searchParams }) {
  const profile = await getCurrentProfile();
  if (!profile?.role) {
    return (
      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-6">
        <Nav email={profile?.email} role={profile?.role} />
        <section className="card-3d p-6">
          <h2 className="mb-2 text-base font-semibold text-ink">Akun belum diaktifkan</h2>
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Hubungi admin untuk mengaktifkan akses cabang.</p>
        </section>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: branches } = await supabase
    .from("tiktok_accounts").select("id, nama_cabang, tiktok_username").eq("is_active", true).order("nama_cabang");
  const sp = (await searchParams) || {};
  const selectedId = sp.branch || branches?.[0]?.id || null;

  let content = [], overview = [], follower = [], viewers = [], activity = [], gender = [], territories = [];
  if (selectedId) {
    const res = await Promise.all([
      supabase.from("tiktok_content").select("*").eq("tiktok_account_id", selectedId).order("post_date", { ascending: false }),
      supabase.from("tiktok_daily_overview").select("*").eq("tiktok_account_id", selectedId).order("date", { ascending: false }),
      supabase.from("tiktok_follower_history").select("*").eq("tiktok_account_id", selectedId).order("date", { ascending: false }),
      supabase.from("tiktok_viewers").select("*").eq("tiktok_account_id", selectedId).order("date", { ascending: false }),
      supabase.from("tiktok_follower_activity").select("*").eq("tiktok_account_id", selectedId).order("date", { ascending: false }).order("hour"),
      supabase.from("tiktok_follower_gender").select("*").eq("tiktok_account_id", selectedId).order("snapshot_date", { ascending: false }),
      supabase.from("tiktok_follower_territories").select("*").eq("tiktok_account_id", selectedId).order("distribution_pct", { ascending: false }),
    ]);
    [content, overview, follower, viewers, activity, gender, territories] = res.map((r) => r.data || []);
  }

  // Bulan tersedia (dari kolom tanggal aspek time-series).
  const monthSet = new Set();
  content.forEach((r) => r.post_date && monthSet.add(monthOf(r.post_date)));
  [...overview, ...follower, ...viewers, ...activity].forEach((r) => r.date && monthSet.add(monthOf(r.date)));
  const months = [...monthSet].filter(Boolean).sort().reverse();
  const selectedMonth = sp.month || "all";

  // Filter per bulan (aspek time-series). Snapshot (gender/lokasi) selalu tampil terkini.
  const inMonth = (d) => selectedMonth === "all" || monthOf(d) === selectedMonth;
  const fContent = content.filter((r) => inMonth(r.post_date));
  const fOverview = overview.filter((r) => inMonth(r.date));
  const fFollower = follower.filter((r) => inMonth(r.date));
  const fViewers = viewers.filter((r) => inMonth(r.date));
  const fActivity = activity.filter((r) => inMonth(r.date));

  // Periode data konten (tanggal terlama–terbaru).
  const postDates = content.map((r) => r.post_date).filter(Boolean).sort();
  const periode = postDates.length ? `${postDates[0]} s/d ${postDates[postDates.length - 1]}` : "—";

  return (
    <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <Nav email={profile.email} role={profile.role} />

      <div className="px-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-sm sm:text-3xl">Data Cabang</h1>
        <p className="mt-0.5 text-sm" style={{ color: "rgba(255,255,255,.75)" }}>
          Data mentah yang sudah diupload, per aspek · periode konten: {periode}
        </p>
      </div>

      <DataFilters branches={branches || []} months={months} selectedBranch={selectedId} selectedMonth={selectedMonth} />

      {!selectedId ? (
        <section className="card-3d p-6"><p className="text-sm" style={{ color: "var(--ink-soft)" }}>Belum ada cabang.</p></section>
      ) : (
        <>
          <Section title="Konten" count={fContent.length}>
            <DataTable
              rows={fContent}
              emptyText="Tidak ada konten pada bulan ini."
              columns={[
                { key: "video_title", label: "Judul", render: (r) => <span className="line-clamp-1 block max-w-xs" title={r.video_title}>{r.video_title || "-"}</span> },
                { key: "post_date", label: "Tanggal" },
                { key: "total_views", label: "Views", align: "right" },
                { key: "total_likes", label: "Likes", align: "right" },
                { key: "total_comments", label: "Komentar", align: "right", render: (r) => numCell(r, "total_comments") },
                { key: "total_shares", label: "Shares", align: "right" },
                { key: "er", label: "ER", align: "right", render: erOf },
              ]}
            />
          </Section>

          <Section title="Overview Harian" count={fOverview.length}>
            <DataTable
              rows={fOverview}
              emptyText="Tidak ada data harian pada bulan ini."
              columns={[
                { key: "date", label: "Tanggal" },
                { key: "video_views", label: "Video views", align: "right" },
                { key: "profile_views", label: "Profile views", align: "right" },
                { key: "likes", label: "Likes", align: "right" },
                { key: "comments", label: "Komentar", align: "right", render: (r) => numCell(r, "comments") },
                { key: "shares", label: "Shares", align: "right" },
              ]}
            />
          </Section>

          <Section title="Riwayat Follower" count={fFollower.length}>
            <DataTable
              rows={fFollower}
              emptyText="Tidak ada data follower pada bulan ini."
              columns={[
                { key: "date", label: "Tanggal" },
                { key: "followers", label: "Followers", align: "right" },
                { key: "diff_from_previous_day", label: "Selisih", align: "right", render: (r) => {
                  const d = Number(r.diff_from_previous_day) || 0;
                  return <span style={{ color: d > 0 ? "#166534" : d < 0 ? "#b91c1c" : undefined }}>{d > 0 ? `+${fmt(d)}` : fmt(d)}</span>;
                } },
              ]}
            />
          </Section>

          <Section title="Viewers Harian" count={fViewers.length}>
            <DataTable
              rows={fViewers}
              emptyText="Tidak ada data viewers pada bulan ini."
              columns={[
                { key: "date", label: "Tanggal" },
                { key: "total_viewers", label: "Total", align: "right" },
                { key: "new_viewers", label: "Baru", align: "right" },
                { key: "returning_viewers", label: "Kembali", align: "right" },
                { key: "status", label: "Status", render: (r) => r.is_incomplete ? <span className="text-amber-700">⚠️ Belum lengkap</span> : <span style={{ color: "var(--ink-soft)" }}>Lengkap</span> },
              ]}
            />
          </Section>

          <Section title="Aktivitas Follower (per jam)" count={fActivity.length}>
            <DataTable
              rows={fActivity}
              emptyText="Tidak ada data aktivitas pada bulan ini."
              columns={[
                { key: "date", label: "Tanggal" },
                { key: "hour", label: "Jam", align: "right", render: (r) => `${String(r.hour).padStart(2, "0")}:00` },
                { key: "active_followers", label: "Follower aktif", align: "right" },
              ]}
            />
          </Section>

          <Section title="Gender Follower (snapshot terkini)" count={gender.length}>
            <DataTable
              rows={gender}
              emptyText="Belum ada data gender."
              columns={[
                { key: "snapshot_date", label: "Tanggal snapshot" },
                { key: "male_pct", label: "Pria", align: "right", render: (r) => pct(r.male_pct) },
                { key: "female_pct", label: "Wanita", align: "right", render: (r) => pct(r.female_pct) },
                { key: "other_pct", label: "Lainnya", align: "right", render: (r) => pct(r.other_pct) },
              ]}
            />
          </Section>

          <Section title="Lokasi Follower (snapshot terkini)" count={territories.length}>
            <DataTable
              rows={territories}
              emptyText="Belum ada data lokasi."
              columns={[
                { key: "territory_code", label: "Kode wilayah" },
                { key: "distribution_pct", label: "Distribusi", align: "right", render: (r) => pct(r.distribution_pct) },
                { key: "snapshot_date", label: "Tanggal snapshot" },
              ]}
            />
          </Section>
        </>
      )}
    </main>
  );
}

// Komponen: Section — kartu berjudul + jumlah baris untuk membungkus tiap tabel.
function Section({ title, count, children }) {
  return (
    <section className="card-3d p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: "rgba(0,102,116,.1)", color: "var(--teal-900)" }}>
          {count} baris
        </span>
      </div>
      {children}
    </section>
  );
}
