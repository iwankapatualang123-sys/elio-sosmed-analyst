// File: app/data/page.jsx
// Halaman "Data" (terproteksi): tampilkan data mentah yang sudah diupload per aspek
// (Konten, Overview, Follower, Gender, Lokasi, Aktivitas, Viewers) dalam tabel,
// dengan filter cabang + bulan. Blueprint bagian 20 & 21A.

import { getCurrentProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import DataFilters from "@/components/DataFilters";
import DataTable from "@/components/DataTable";
import { BarChartLabeled, DivergingBarChart } from "@/components/Charts";
import { weeklyContentTrend, weeklyOverviewTrend, weeklyFollowerTrend } from "@/lib/tiktok/weekly";

const monthOf = (d) => (typeof d === "string" ? d.slice(0, 7) : null);
const fmtNum = (n) => Number(n || 0).toLocaleString("id-ID");

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

  // Tren mingguan (hanya masuk akal kalau 1 bulan spesifik dipilih — kalau "semua
  // bulan", hari-5-Juni & hari-5-Juli akan ketumpuk jadi 1 minggu yang salah).
  const showWeekly = selectedMonth !== "all";
  const weeklyContent = showWeekly ? weeklyContentTrend(fContent) : [];
  const weeklyOverview = showWeekly ? weeklyOverviewTrend(fOverview) : [];
  const weeklyFollower = showWeekly ? weeklyFollowerTrend(fFollower) : [];

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

      {!showWeekly && selectedId && months.length > 0 && (
        <div className="rounded-xl px-4 py-2.5 text-sm" style={{ background: "rgba(240,180,90,.15)", color: "#8a5a12" }}>
          💡 <b>Grafik tren mingguan</b> muncul kalau Anda memilih <b>satu bulan spesifik</b> di filter <b>Bulan</b> di atas (mis. {months[0]}). Sekarang filter di &quot;Semua bulan&quot;, jadi mingguan disembunyikan.
        </div>
      )}

      {showWeekly && (weeklyContent.length > 0 || weeklyOverview.length > 0 || weeklyFollower.length > 0) && (
        <section className="card-3d p-4 sm:p-5">
          <h2 className="mb-1 text-base font-semibold text-ink">📈 Tren Mingguan dalam Bulan Ini</h2>
          <p className="mb-3 text-xs" style={{ color: "var(--ink-soft)" }}>
            Data bulan terpilih dipecah per minggu (Minggu 1 = tgl 1–7, Minggu 2 = 8–14, dst) — supaya kelihatan
            naik/turunnya performa DALAM sebulan, bukan cuma total bulanannya.
          </p>
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <h3 className="mb-2 text-xs font-semibold text-ink">Views per Minggu (Konten)</h3>
              <BarChartLabeled data={weeklyContent.map((w) => ({ label: w.label.replace("Minggu ", "M"), value: w.views }))} format={fmtNum} height={150} />
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold text-ink">Jumlah Konten per Minggu</h3>
              <BarChartLabeled data={weeklyContent.map((w) => ({ label: w.label.replace("Minggu ", "M"), value: w.count }))} format={fmtNum} height={150} />
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold text-ink">Pertumbuhan Follower per Minggu</h3>
              <DivergingBarChart data={weeklyFollower.map((w) => ({ label: w.label.replace("Minggu ", "M"), value: w.netGrowth }))} format={fmtNum} height={150} />
            </div>
          </div>
          {weeklyOverview.length > 0 && (
            <div className="mt-5 overflow-x-auto">
              <h3 className="mb-2 text-xs font-semibold text-ink">Ringkasan Overview per Minggu</h3>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr style={{ color: "var(--ink-soft)" }}>
                    <th className="py-1.5 pr-3 font-medium">Minggu</th>
                    <th className="py-1.5 pr-3 font-medium text-right">Video views</th>
                    <th className="py-1.5 pr-3 font-medium text-right">Profile views</th>
                    <th className="py-1.5 pr-3 font-medium text-right">Likes</th>
                    <th className="py-1.5 pr-3 font-medium text-right">Komentar</th>
                    <th className="py-1.5 pr-3 font-medium text-right">Shares</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyOverview.map((w) => (
                    <tr key={w.week} className="border-t" style={{ borderColor: "rgba(0,60,68,.08)" }}>
                      <td className="py-1.5 pr-3 font-medium text-ink">{w.label}</td>
                      <td className="py-1.5 pr-3 text-right">{fmtNum(w.videoViews)}</td>
                      <td className="py-1.5 pr-3 text-right">{fmtNum(w.profileViews)}</td>
                      <td className="py-1.5 pr-3 text-right">{fmtNum(w.likes)}</td>
                      <td className="py-1.5 pr-3 text-right">{fmtNum(w.comments)}</td>
                      <td className="py-1.5 pr-3 text-right">{fmtNum(w.shares)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {!selectedId ? (
        <section className="card-3d p-6"><p className="text-sm" style={{ color: "var(--ink-soft)" }}>Belum ada cabang.</p></section>
      ) : (
        <>
          <Section title="Konten" count={fContent.length}>
            <DataTable
              rows={fContent}
              maxHeight={640}
              emptyText="Tidak ada konten pada bulan ini."
              columns={[
                { key: "video_link", label: "Preview", format: "thumbnail" },
                { key: "video_title", label: "Judul", format: "title", width: 320 },
                { key: "post_date", label: "Tanggal", format: "date" },
                { key: "total_views", label: "Views", align: "right", format: "number" },
                { key: "total_likes", label: "Likes", align: "right", format: "number" },
                { key: "total_comments", label: "Komentar", align: "right", format: "number" },
                { key: "total_shares", label: "Shares", align: "right", format: "number" },
                { key: "er", label: "ER", align: "right", format: "er" },
              ]}
            />
          </Section>

          <Section title="Overview Harian" count={fOverview.length}>
            <DataTable
              rows={fOverview}
              emptyText="Tidak ada data harian pada bulan ini."
              columns={[
                { key: "date", label: "Tanggal", format: "date" },
                { key: "video_views", label: "Video views", align: "right", format: "number" },
                { key: "profile_views", label: "Profile views", align: "right", format: "number" },
                { key: "likes", label: "Likes", align: "right", format: "number" },
                { key: "comments", label: "Komentar", align: "right", format: "number" },
                { key: "shares", label: "Shares", align: "right", format: "number" },
              ]}
            />
          </Section>

          <Section title="Riwayat Follower" count={fFollower.length}>
            <DataTable
              rows={fFollower}
              emptyText="Tidak ada data follower pada bulan ini."
              columns={[
                { key: "date", label: "Tanggal", format: "date" },
                { key: "followers", label: "Followers", align: "right", format: "number" },
                { key: "diff_from_previous_day", label: "Selisih", align: "right", format: "diff" },
              ]}
            />
          </Section>

          <Section title="Viewers Harian" count={fViewers.length}>
            <DataTable
              rows={fViewers}
              emptyText="Tidak ada data viewers pada bulan ini."
              columns={[
                { key: "date", label: "Tanggal", format: "date" },
                { key: "total_viewers", label: "Total", align: "right", format: "number" },
                { key: "new_viewers", label: "Baru", align: "right", format: "number" },
                { key: "returning_viewers", label: "Kembali", align: "right", format: "number" },
                { key: "status", label: "Status", format: "incomplete" },
              ]}
            />
          </Section>

          <Section title="Aktivitas Follower (per jam)" count={fActivity.length}>
            <DataTable
              rows={fActivity}
              emptyText="Tidak ada data aktivitas pada bulan ini."
              columns={[
                { key: "date", label: "Tanggal", format: "date" },
                { key: "hour", label: "Jam", align: "right", format: "hour" },
                { key: "active_followers", label: "Follower aktif", align: "right", format: "number" },
              ]}
            />
          </Section>

          <Section title="Gender Follower (snapshot terkini)" count={gender.length}>
            <DataTable
              rows={gender}
              emptyText="Belum ada data gender."
              columns={[
                { key: "snapshot_date", label: "Tanggal snapshot", format: "date" },
                { key: "male_pct", label: "Pria", align: "right", format: "pct" },
                { key: "female_pct", label: "Wanita", align: "right", format: "pct" },
                { key: "other_pct", label: "Lainnya", align: "right", format: "pct" },
              ]}
            />
          </Section>

          <Section title="Lokasi Follower (snapshot terkini)" count={territories.length}>
            <DataTable
              rows={territories}
              emptyText="Belum ada data lokasi."
              columns={[
                { key: "territory_code", label: "Kode wilayah", format: "text" },
                { key: "distribution_pct", label: "Distribusi", align: "right", format: "pct" },
                { key: "snapshot_date", label: "Tanggal snapshot", format: "date" },
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
