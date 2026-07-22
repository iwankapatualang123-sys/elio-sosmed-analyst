// File: app/data/page.jsx
// Halaman "Data" (terproteksi): tampilkan data mentah yang sudah diupload per aspek
// (Konten, Overview, Follower, Gender, Lokasi, Aktivitas, Viewers) dalam tabel,
// dengan filter cabang + bulan. Blueprint bagian 20 & 21A.

import { getCurrentProfile } from "@/lib/auth";
import { createReadClient } from "@/lib/db-compat";
import Nav from "@/components/Nav";
import DataFilters from "@/components/DataFilters";
import DataTable from "@/components/DataTable";
import ContentGrid from "@/components/ContentGrid";
import { BarChartLabeled, DivergingBarChart, Heatmap } from "@/components/Charts";
import { weeklyReport } from "@/lib/tiktok/weekly";
import { bestPostingTimes } from "@/lib/tiktok/metrics";
import { erOf } from "@/lib/instagram/metrics";

const monthOf = (d) => (typeof d === "string" ? d.slice(0, 7) : null);
const fmtNum = (n) => Number(n || 0).toLocaleString("id-ID");
const BULAN_NAMA = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
function labelBulan(ym) {
  const [y, m] = String(ym).split("-");
  return `${BULAN_NAMA[Number(m) - 1] || m} ${y}`;
}
// Angka merah kalau minus (mis. komentar berkurang krn dihapus) — konsisten dgn
// warna diff di tempat lain, supaya minus tidak terlihat seperti error tampilan.
function numCell(n) {
  const v = Number(n) || 0;
  return <span style={v < 0 ? { color: "#b91c1c", fontWeight: 600 } : undefined}>{fmtNum(v)}</span>;
}

// Kolom tabel Konten — dipakai bersama utk tabel "bulan ini" & "bulan lain yg masih tinggi".
const KONTEN_COLUMNS = [
  { key: "video_link", label: "Preview", format: "thumbnail" },
  { key: "video_title", label: "Judul", format: "title", width: 320 },
  { key: "post_date", label: "Tanggal", format: "date" },
  { key: "total_views", label: "Views", align: "right", format: "number" },
  { key: "total_likes", label: "Likes", align: "right", format: "number" },
  { key: "total_comments", label: "Komentar", align: "right", format: "number" },
  { key: "total_shares", label: "Shares", align: "right", format: "number" },
  { key: "er", label: "ER", align: "right", format: "er" },
];


export default async function DataPage({ searchParams }) {
  const profile = await getCurrentProfile();
  if (!profile?.role) {
    return (
      <main className="relative z-10 mx-auto grid3 min-h-screen w-full max-w-6xl p-6">
        <Nav email={profile?.email} role={profile?.role} />
        <section className="card-3d p-6">
          <h2 className="mb-2 text-base font-semibold text-ink">Akun belum diaktifkan</h2>
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Hubungi admin untuk mengaktifkan akses cabang.</p>
        </section>
      </main>
    );
  }

  const supabase = await createReadClient(profile);
  const { data: branches } = await supabase
    .from("tiktok_accounts").select("id, nama_cabang, tiktok_username").eq("is_active", true).order("nama_cabang");
  const sp = (await searchParams) || {};
  const selectedId = sp.branch || branches?.[0]?.id || null;

  let content = [], overview = [], follower = [], viewers = [], activity = [], gender = [], territories = [], igContent = [], igDaily = [];
  if (selectedId) {
    const res = await Promise.all([
      supabase.from("tiktok_content").select("*").eq("tiktok_account_id", selectedId).order("post_date", { ascending: false }),
      supabase.from("tiktok_daily_overview").select("*").eq("tiktok_account_id", selectedId).order("date", { ascending: false }),
      supabase.from("tiktok_follower_history").select("*").eq("tiktok_account_id", selectedId).order("date", { ascending: false }),
      supabase.from("tiktok_viewers").select("*").eq("tiktok_account_id", selectedId).order("date", { ascending: false }),
      supabase.from("tiktok_follower_activity").select("*").eq("tiktok_account_id", selectedId).order("date", { ascending: false }).order("hour"),
      supabase.from("tiktok_follower_gender").select("*").eq("tiktok_account_id", selectedId).order("snapshot_date", { ascending: false }),
      supabase.from("tiktok_follower_territories").select("*").eq("tiktok_account_id", selectedId).order("distribution_pct", { ascending: false }),
      supabase.from("instagram_content").select("*").eq("tiktok_account_id", selectedId).order("published_at", { ascending: false }),
      supabase.from("instagram_daily_metrics").select("metric, date, value").eq("tiktok_account_id", selectedId).order("date", { ascending: false }),
    ]);
    [content, overview, follower, viewers, activity, gender, territories, igContent, igDaily] = res.map((r) => r.data || []);
  }

  // Bulan tersedia (dari kolom tanggal aspek time-series, TikTok + Instagram).
  const monthSet = new Set();
  content.forEach((r) => r.post_date && monthSet.add(monthOf(r.post_date)));
  [...overview, ...follower, ...viewers, ...activity].forEach((r) => r.date && monthSet.add(monthOf(r.date)));
  igContent.forEach((r) => r.published_at && monthSet.add(monthOf(String(r.published_at))));
  igDaily.forEach((r) => r.date && monthSet.add(monthOf(r.date)));
  const months = [...monthSet].filter(Boolean).sort().reverse();
  const selectedMonth = sp.month || "all";

  // Filter per bulan (aspek time-series). Snapshot (gender/lokasi) selalu tampil terkini.
  const inMonth = (d) => selectedMonth === "all" || monthOf(d) === selectedMonth;
  const fContent = content.filter((r) => inMonth(r.post_date));
  const fOverview = overview.filter((r) => inMonth(r.date));
  const fFollower = follower.filter((r) => inMonth(r.date));
  const fViewers = viewers.filter((r) => inMonth(r.date));
  const fActivity = activity.filter((r) => inMonth(r.date));

  // Data Instagram (dari upload export Business Suite) — ikut filter bulan.
  // Baris konten dipetakan ke bentuk kolom DataTable (video_link/video_title/
  // post_date) supaya format 'title' & sorting jalan tanpa kolom khusus IG.
  const fIgContent = igContent
    .filter((r) => inMonth(String(r.published_at ?? "").slice(0, 10)))
    .map((c) => ({
      ...c,
      jenis: String(c.post_type ?? "").replace(/\s*IG$/i, "") || "—",
      video_link: c.permalink,
      // Caption UTUH (bukan cuma baris pertama) — sel 'title' sendiri yang melipat
      // 2 baris + chip hashtag + "Lihat selengkapnya", persis tabel Konten TikTok.
      video_title: c.description || "",
      post_date: String(c.published_at ?? "").slice(0, 10),
      er: erOf(c),
      kolab: c.is_collab ? "✓ kolab" : "",
    }));
  // Pivot metrik harian: 1 baris per tanggal, kolom per metrik.
  const igDailyByDate = new Map();
  for (const r of igDaily) {
    if (!inMonth(r.date)) continue;
    const k = String(r.date).slice(0, 10);
    if (!igDailyByDate.has(k)) igDailyByDate.set(k, { date: k });
    igDailyByDate.get(k)[r.metric] = r.value;
  }
  const igDailyRows = [...igDailyByDate.values()].sort((a, b) => b.date.localeCompare(a.date));
  const hasIg = igContent.length > 0 || igDaily.length > 0;

  // GABUNGAN data harian TikTok (Overview + Follower + Viewers) jadi 1 tabel
  // per tanggal — pengganti 3 tabel terpisah yang bulky. Kolom kosong = aspek
  // itu tidak punya data di tanggal tsb (bukan 0).
  const dailyMap = new Map();
  const rowFor = (d) => {
    const k = String(d).slice(0, 10);
    if (!dailyMap.has(k)) dailyMap.set(k, { date: k });
    return dailyMap.get(k);
  };
  for (const r of fOverview) Object.assign(rowFor(r.date), { video_views: r.video_views, profile_views: r.profile_views, likes: r.likes, comments: r.comments, shares: r.shares });
  for (const r of fFollower) Object.assign(rowFor(r.date), { followers: r.followers, follower_diff: r.diff_from_previous_day });
  for (const r of fViewers) Object.assign(rowFor(r.date), { total_viewers: r.total_viewers, new_viewers: r.new_viewers, returning_viewers: r.returning_viewers, is_incomplete: r.is_incomplete });
  const dailyMerged = [...dailyMap.values()].sort((a, b) => b.date.localeCompare(a.date));

  // Aktivitas follower per jam -> heatmap hari×jam (ringkas), tabel mentah dilipat.
  const bestAct = fActivity.length > 0 ? bestPostingTimes(fActivity, { top: 5 }) : null;

  // Snapshot audiens terkini (gender & lokasi) utk kartu visual.
  const latestGender = gender[0] || null;

  // Periode data konten (tanggal terlama–terbaru).
  const postDates = content.map((r) => r.post_date).filter(Boolean).sort();
  const periode = postDates.length ? `${postDates[0]} s/d ${postDates[postDates.length - 1]}` : "—";

  // Pisahkan tabel Konten saat 1 bulan spesifik dipilih: (1) konten bulan itu, dan
  // (2) konten BULAN LAIN yang masih menonjol (views di atas rata-rata seluruh
  // konten akun) — supaya video lama yang masih ramai tidak tercampur diam-diam di
  // tengah daftar bulan berjalan. Catatan: data cuma simpan angka views TERKINI per
  // video (di-timpa tiap upload baru), bukan riwayat harian per video — jadi ini
  // "masih tinggi performanya", BUKAN "sedang naik minggu ini" (itu tidak terukur).
  const splitContent = selectedMonth !== "all";
  const avgViewsAll = content.length ? content.reduce((s, r) => s + (Number(r.total_views) || 0), 0) / content.length : 0;
  const contentOtherNotable = splitContent
    ? content
        .filter((r) => !inMonth(r.post_date) && (Number(r.total_views) || 0) >= avgViewsAll)
        .sort((a, b) => (Number(b.total_views) || 0) - (Number(a.total_views) || 0))
    : [];

  // Tren mingguan (hanya masuk akal kalau 1 bulan spesifik dipilih — kalau "semua
  // bulan", hari-5-Juni & hari-5-Juli akan ketumpuk jadi 1 minggu yang salah).
  const showWeekly = selectedMonth !== "all";
  const weekly = showWeekly ? weeklyReport({ content, overview, history: follower }, selectedMonth) : null;
  const weeklyContent = weekly ? weekly.content : [];
  const weeklyOverview = weekly ? weekly.overview : [];
  const weeklyFollower = weekly ? weekly.follower : [];
  const weeklyWeeks = weekly ? weekly.weeks : [];

  return (
    <main className="relative z-10 mx-auto grid3 min-h-screen w-full max-w-6xl p-4 sm:p-6">
      <Nav email={profile.email} role={profile.role} />

      <div className="px-1">
        <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-sm sm:text-2xl">Data Cabang</h1>
        <p className="mt-0.5 text-sm" style={{ color: "var(--on-bg-soft)" }}>
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
            Data {labelBulan(selectedMonth)} dipecah per minggu berdasarkan tanggal (mis. 1–7, 8–14, dst) — supaya kelihatan
            naik/turunnya performa DALAM sebulan, bukan cuma total bulanannya. Label di grafik = rentang tanggal minggu itu.
          </p>
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <h3 className="text-xs font-semibold text-ink">Total Views Video yang Terbit Minggu Ini</h3>
              <p className="mb-2 text-[10px]" style={{ color: "var(--ink-soft)" }}>
                Views video dihitung dari tanggal video PERTAMA TAYANG — angkanya akumulasi s/d hari ini, bukan cuma views hari itu (beda dari tabel di bawah).
              </p>
              <BarChartLabeled data={weeklyContent.map((w, i) => ({ label: weeklyWeeks[i]?.rangeShort || w.label, value: w.views }))} format={fmtNum} height={150} />
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold text-ink">Jumlah Konten per Minggu</h3>
              <BarChartLabeled data={weeklyContent.map((w, i) => ({ label: weeklyWeeks[i]?.rangeShort || w.label, value: w.count }))} format={fmtNum} height={150} />
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold text-ink">Pertumbuhan Follower per Minggu</h3>
              <DivergingBarChart data={weeklyFollower.map((w, i) => ({ label: weeklyWeeks[i]?.rangeShort || w.label, value: w.netGrowth }))} format={fmtNum} height={150} />
            </div>
          </div>
          {weeklyOverview.length > 0 && (
            <div className="mt-5 overflow-x-auto">
              <h3 className="text-xs font-semibold text-ink">Ringkasan Overview per Minggu</h3>
              <p className="mb-2 text-[10px]" style={{ color: "var(--ink-soft)" }}>
                Angka resmi TikTok yang tercatat PADA hari-hari itu (semua video, bukan cuma yang baru terbit) — makanya &quot;Video views&quot; di sini wajar beda dengan grafik views di atas. Angka merah = berkurang (mis. komentar dihapus).
              </p>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr style={{ color: "var(--ink-soft)" }}>
                    <th className="py-1.5 pr-3 font-medium">Minggu</th>
                    <th className="py-1.5 pr-3 font-medium">Tanggal</th>
                    <th className="py-1.5 pr-3 font-medium text-right">Video views</th>
                    <th className="py-1.5 pr-3 font-medium text-right">Profile views</th>
                    <th className="py-1.5 pr-3 font-medium text-right">Likes</th>
                    <th className="py-1.5 pr-3 font-medium text-right">Komentar</th>
                    <th className="py-1.5 pr-3 font-medium text-right">Shares</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyOverview.map((w, i) => (
                    <tr key={w.week} className="border-t" style={{ borderColor: "rgba(0,60,68,.08)" }}>
                      <td className="py-1.5 pr-3 font-medium text-ink">{w.label}</td>
                      <td className="whitespace-nowrap py-1.5 pr-3" style={{ color: "var(--ink-soft)" }}>{weeklyWeeks[i]?.rangeLabel || "—"}</td>
                      <td className="py-1.5 pr-3 text-right">{numCell(w.videoViews)}</td>
                      <td className="py-1.5 pr-3 text-right">{numCell(w.profileViews)}</td>
                      <td className="py-1.5 pr-3 text-right">{numCell(w.likes)}</td>
                      <td className="py-1.5 pr-3 text-right">{numCell(w.comments)}</td>
                      <td className="py-1.5 pr-3 text-right">{numCell(w.shares)}</td>
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
          {splitContent ? (
            <>
              <Section title={`Konten ${labelBulan(selectedMonth)}`} count={fContent.length} subtitle="Video yang diposting pada bulan terpilih ini.">
                <ContentGrid rows={fContent} emptyText="Belum ada konten bulan ini." />
              </Section>

              {contentOtherNotable.length > 0 && (
                <Section
                  title="📌 Konten Bulan Lain yang Masih Tinggi Performanya"
                  count={contentOtherNotable.length}
                  subtitle={`Video dari bulan LAIN dgn views di atas rata-rata seluruh konten akun (${fmtNum(Math.round(avgViewsAll))}) — masih menarik trafik meski lama, dipisah supaya tidak tercampur dgn konten bulan ini.`}
                >
                  <ContentGrid rows={contentOtherNotable} emptyText="Tidak ada." />
                </Section>
              )}
            </>
          ) : (
            <Section title="Konten" count={content.length} subtitle="Semua video akun ini (tidak difilter bulan — filter Bulan hanya untuk data harian & tren mingguan).">
              <ContentGrid rows={content} emptyText="Belum ada konten." />
            </Section>
          )}

          {/* 1 tabel harian gabungan — pengganti 3 tabel (Overview/Follower/Viewers). */}
          <Section
            title="📅 Data Harian Akun"
            count={dailyMerged.length}
            subtitle="Overview + follower + viewers digabung per tanggal (pengganti 3 tabel terpisah). Sel kosong = aspek itu tidak punya data di tanggal tsb. Angka merah = berkurang."
          >
            <DataTable
              rows={dailyMerged}
              maxHeight={440}
              defaultSort={{ key: "date", dir: "desc" }}
              emptyText="Tidak ada data harian pada bulan ini."
              columns={[
                { key: "date", label: "Tanggal", format: "date" },
                { key: "video_views", label: "Video views", align: "right", format: "number" },
                { key: "profile_views", label: "Profile views", align: "right", format: "number" },
                { key: "likes", label: "Likes", align: "right", format: "number" },
                { key: "comments", label: "Komentar", align: "right", format: "number" },
                { key: "shares", label: "Shares", align: "right", format: "number" },
                { key: "followers", label: "Followers", align: "right", format: "number" },
                { key: "follower_diff", label: "Δ", align: "right", format: "diff" },
                { key: "total_viewers", label: "Viewers", align: "right", format: "number" },
                { key: "new_viewers", label: "Baru", align: "right", format: "number" },
                { key: "returning_viewers", label: "Kembali", align: "right", format: "number" },
                { key: "status", label: "Status", format: "incomplete" },
              ]}
            />
          </Section>

          {/* Aktivitas follower: heatmap ringkas (spt Dashboard), tabel mentah dilipat. */}
          <Section title="⏰ Aktivitas Follower (jam × hari)" count={fActivity.length}>
            {bestAct ? (
              <>
                <Heatmap heatmap={bestAct.heatmap} />
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold" style={{ color: "var(--teal-900)" }}>Lihat tabel mentah per jam</summary>
                  <div className="mt-2">
                    <DataTable
                      rows={fActivity}
                      maxHeight={320}
                      defaultSort={{ key: "date", dir: "desc" }}
                      emptyText="—"
                      columns={[
                        { key: "date", label: "Tanggal", format: "date" },
                        { key: "hour", label: "Jam", align: "right", format: "hour" },
                        { key: "active_followers", label: "Follower aktif", align: "right", format: "number" },
                      ]}
                    />
                  </div>
                </details>
              </>
            ) : (
              <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Tidak ada data aktivitas pada bulan ini.</p>
            )}
          </Section>

          {/* Audiens: gender & lokasi terkini sbg visual ringkas, riwayat dilipat. */}
          <Section title="👥 Profil Audiens (snapshot terkini)" count={gender.length + territories.length}>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-semibold text-ink">
                  Gender follower {latestGender?.snapshot_date ? <span className="font-normal" style={{ color: "var(--ink-soft)" }}>· per {latestGender.snapshot_date}</span> : null}
                </h3>
                {latestGender ? <GenderBar row={latestGender} /> : (
                  <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Belum ada data gender.</p>
                )}
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold text-ink">
                  Lokasi follower teratas {territories[0]?.snapshot_date ? <span className="font-normal" style={{ color: "var(--ink-soft)" }}>· per {territories[0].snapshot_date}</span> : null}
                </h3>
                {territories.length > 0 ? <TerritoryBars rows={territories} limit={6} /> : (
                  <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Belum ada data lokasi.</p>
                )}
              </div>
            </div>
            {(gender.length > 1 || territories.length > 6) && (
              <details className="mt-4">
                <summary className="cursor-pointer text-xs font-semibold" style={{ color: "var(--teal-900)" }}>Lihat riwayat & daftar lengkap</summary>
                <div className="mt-2 grid gap-4 sm:grid-cols-2">
                  <DataTable
                    rows={gender}
                    maxHeight={280}
                    defaultSort={{ key: "snapshot_date", dir: "desc" }}
                    emptyText="—"
                    columns={[
                      { key: "snapshot_date", label: "Tanggal", format: "date" },
                      { key: "male_pct", label: "Pria", align: "right", format: "pct" },
                      { key: "female_pct", label: "Wanita", align: "right", format: "pct" },
                      { key: "other_pct", label: "Lainnya", align: "right", format: "pct" },
                    ]}
                  />
                  <DataTable
                    rows={territories}
                    maxHeight={280}
                    emptyText="—"
                    columns={[
                      { key: "territory_code", label: "Wilayah", format: "text" },
                      { key: "distribution_pct", label: "Distribusi", align: "right", format: "pct" },
                      { key: "snapshot_date", label: "Tanggal", format: "date" },
                    ]}
                  />
                </div>
              </details>
            )}
          </Section>

          {hasIg && (
            <>
              <Section
                title="📸 Konten Instagram"
                count={fIgContent.length}
                subtitle="Dari export per konten Meta Business Suite (angka kumulatif saat export — diperbarui tiap upload ulang). ER = (suka + komentar + share + simpan) ÷ tayangan. Konten kolaborasi akun lain ditandai di kolom Kolab."
              >
                <DataTable
                  rows={fIgContent}
                  maxHeight={480}
                  defaultSort={{ key: "post_date", dir: "desc" }}
                  emptyText="Tidak ada konten IG pada bulan ini."
                  columns={[
                    { key: "jenis", label: "Jenis", format: "text", width: 70 },
                    { key: "video_title", label: "Caption", format: "title", width: 320 },
                    { key: "post_date", label: "Tanggal", format: "date" },
                    { key: "views", label: "Tayangan", align: "right", format: "number" },
                    { key: "reach", label: "Jangkauan", align: "right", format: "number" },
                    { key: "likes", label: "Suka", align: "right", format: "number" },
                    { key: "comments", label: "Komentar", align: "right", format: "number" },
                    { key: "shares", label: "Share", align: "right", format: "number" },
                    { key: "saves", label: "Simpan", align: "right", format: "number" },
                    { key: "follows", label: "+Follower", align: "right", format: "diff" },
                    { key: "er", label: "ER", align: "right", format: "pct" },
                    { key: "kolab", label: "Kolab", format: "text", width: 70 },
                  ]}
                />
              </Section>

              <Section
                title="📸 Metrik Harian Instagram"
                count={igDailyRows.length}
                subtitle="Angka akun per hari dari export Business Suite. Tayangan mencakup semua jenis konten termasuk Story."
              >
                <DataTable
                  rows={igDailyRows}
                  defaultSort={{ key: "date", dir: "desc" }}
                  emptyText="Tidak ada data harian IG pada bulan ini."
                  columns={[
                    { key: "date", label: "Tanggal", format: "date" },
                    { key: "views", label: "Tayangan", align: "right", format: "number" },
                    { key: "reach", label: "Jangkauan", align: "right", format: "number" },
                    { key: "profile_visits", label: "Kunjungan profil", align: "right", format: "number" },
                    { key: "new_followers", label: "Follower baru", align: "right", format: "diff" },
                  ]}
                />
              </Section>
            </>
          )}
        </>
      )}
    </main>
  );
}

// Komponen: GenderBar — satu bar bertumpuk pria/wanita/lainnya + legenda persen.
// Pengganti tabel gender (1 snapshot = 1 baris angka; visual jauh lebih cepat dibaca).
function GenderBar({ row }) {
  const male = Number(row.male_pct) || 0;
  const female = Number(row.female_pct) || 0;
  const other = Math.max(0, 100 - male - female);
  const seg = [
    { label: "Pria", pct: male, color: "#0a8291" },
    { label: "Wanita", pct: female, color: "#e191ab" },
    { label: "Lainnya", pct: Math.round(other * 10) / 10, color: "#c9c9c9" },
  ].filter((s) => s.pct > 0);
  return (
    <div>
      <div className="flex h-6 w-full overflow-hidden rounded-full" style={{ border: "1px solid rgba(0,60,68,.1)" }}>
        {seg.map((s) => (
          <div key={s.label} style={{ width: `${s.pct}%`, background: s.color }} title={`${s.label} ${s.pct}%`} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "var(--ink-soft)" }}>
        {seg.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            {s.label} <b className="text-ink">{s.pct}%</b>
          </span>
        ))}
      </div>
    </div>
  );
}

// Komponen: TerritoryBars — top-N lokasi sebagai bar horizontal (bukan tabel).
function TerritoryBars({ rows = [], limit = 6 }) {
  const top = rows.slice(0, limit);
  const max = Number(top[0]?.distribution_pct) || 1;
  const rest = rows.slice(limit).reduce((s, r) => s + (Number(r.distribution_pct) || 0), 0);
  return (
    <div className="flex flex-col gap-1.5">
      {top.map((r) => {
        const pct = Number(r.distribution_pct) || 0;
        return (
          <div key={r.territory_code} className="flex items-center gap-2 text-xs">
            <span className="w-24 shrink-0 truncate font-medium text-ink" title={r.territory_code}>{r.territory_code}</span>
            <div className="h-3.5 min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(0,102,116,.08)" }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (pct / max) * 100)}%`, background: "linear-gradient(90deg,#0a8291,#006674)" }} />
            </div>
            <span className="w-12 shrink-0 text-right" style={{ color: "var(--ink-soft)" }}>{pct}%</span>
          </div>
        );
      })}
      {rest > 0 && (
        <p className="mt-0.5 text-[11px]" style={{ color: "var(--ink-soft)" }}>+ {rows.length - top.length} wilayah lain ({Math.round(rest * 10) / 10}%)</p>
      )}
    </div>
  );
}

// Komponen: Section — kartu berjudul + jumlah baris untuk membungkus tiap tabel.
function Section({ title, count, subtitle, children }) {
  return (
    <section className="card-3d p-4 sm:p-5">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: "rgba(0,102,116,.1)", color: "var(--teal-900)" }}>
          {count} baris
        </span>
      </div>
      {subtitle && <p className="mb-3 text-xs" style={{ color: "var(--ink-soft)" }}>{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </section>
  );
}
