// File: app/report/[accountId]/page.jsx
// Laporan performa per cabang — desain minimalis, ditargetkan MAKS 2 HALAMAN saat
// dicetak/Simpan-PDF. Halaman 1: header (logo Elio) + ringkasan eksekutif + KPI
// (dgn perbandingan vs bulan lalu) + target + grafik. Halaman 2: konten terbaik +
// rincian mingguan + rekomendasi + footer metodologi. Server Component + RLS.

import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadBranchDetail } from "@/lib/tiktok/analytics";
import { weekOfMonth } from "@/lib/tiktok/weekly";
import { sumDaily, contentInPeriod, contentSummary, topContents } from "@/lib/instagram/metrics";
import { LineChart, Donut } from "@/components/Charts";
import PrintButton from "@/components/PrintButton";
import Button from "@/components/Button";
import MonthFilter from "@/components/MonthFilter";
import Thumbnail from "@/components/Thumbnail";
import ProgressBar from "@/components/ProgressBar";

const fmt = (n) => Number(n || 0).toLocaleString("id-ID");
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN_NAMA = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
function labelBulan(ym) {
  const [y, m] = ym.split("-");
  return `${BULAN_NAMA[Number(m) - 1] || m} ${y}`;
}
function tglPanjang(d) {
  if (!d || !/^\d{4}-\d{2}-\d{2}/.test(d)) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${Number(day)} ${BULAN_NAMA[Number(m) - 1]} ${y}`;
}

// Badge perubahan ▲▼ % vs periode sebelumnya (dari metrics.benchmark).
function Delta({ bench }) {
  if (!bench) return null;
  // Pembanding 0 (bulan lalu metrik ini nol) -> "%"" tidak bermakna; tampilkan netral.
  if (Number(bench.previous) === 0) return <span className="text-[11px]" style={{ color: "var(--ink-soft)" }}>—</span>;
  const p = Number(bench.deltaPct) || 0;
  if (p === 0) return <span className="text-[11px] font-semibold" style={{ color: "var(--ink-soft)" }}>0%</span>;
  const up = p > 0;
  return (
    <span className="text-[11px] font-semibold" style={{ color: up ? "#166534" : "#b91c1c" }}>
      {up ? "▲" : "▼"} {Math.abs(p)}%
    </span>
  );
}

// Ringkasan eksekutif 2-3 kalimat dari metrik (bahasa awam untuk klien/owner).
function ringkasanEksekutif({ account, periode, s, g, top, comparison }) {
  const parts = [];
  parts.push(`Sepanjang ${periode}, ${account.nama_cabang} memposting ${fmt(s.totalVideos)} konten dengan total ${fmt(s.totalViews)} views (engagement rate ${s.engagementRateOverall}%) dan pertumbuhan ${g.netGrowth >= 0 ? "+" : ""}${fmt(g.netGrowth)} follower.`);
  if (top) parts.push(`Konten terbaik: "${(top.video_title || "tanpa judul").slice(0, 60)}" dengan ${fmt(top.total_views)} views.`);
  if (comparison) {
    const v = comparison.totalViews.deltaPct;
    parts.push(`Dibanding bulan sebelumnya, views ${v >= 0 ? "naik" : "turun"} ${Math.abs(v)}%.`);
  }
  return parts.join(" ");
}

export default async function ReportPage({ params, searchParams }) {
  const { accountId } = await params;
  const profile = await getCurrentProfile();
  if (!profile?.role) return <main className="relative z-10 p-8 text-white">Silakan login.</main>;

  const sp = (await searchParams) || {};
  const month = /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : null;

  const supabase = await createSupabaseServerClient();
  const [{ data: account }, detail] = await Promise.all([
    supabase.from("tiktok_accounts").select("nama_cabang, tiktok_username").eq("id", accountId).maybeSingle(),
    loadBranchDetail(supabase, accountId, { month }),
  ]);
  if (!account || !detail) return <main className="relative z-10 p-8 text-white">Cabang tidak ditemukan atau tidak ada akses.</main>;
  // Target bulan laporan (per platform) — dipakai untuk pencapaian TikTok.
  const goalMonth = month || new Date().toISOString().slice(0, 7);
  const { data: goalsRows } = await supabase.from("tiktok_account_goals").select("*").eq("tiktok_account_id", accountId);
  const goal = (goalsRows || []).find((x) => x.platform === "tiktok" && x.target_month === goalMonth) || null;
  const goalIg = (goalsRows || []).find((x) => x.platform === "instagram" && x.target_month === goalMonth) || null;

  // Data Instagram (dari upload Business Suite) — ringkasan ditambahkan bila ada.
  const [{ data: igDailyRows }, { data: igContentRows }] = await Promise.all([
    supabase.from("instagram_daily_metrics").select("metric, date, value").eq("tiktok_account_id", accountId),
    supabase.from("instagram_content").select("post_id, description, permalink, post_type, published_at, views, likes, comments, shares, saves, follows, is_collab").eq("tiktok_account_id", accountId),
  ]);
  const igDaily = igDailyRows || [];
  const igContentAll = igContentRows || [];
  const hasIg = igDaily.length > 0 || igContentAll.length > 0;
  const igSum = sumDaily(igDaily, month);
  const igContents = contentInPeriod(igContentAll, month);
  const igCSum = contentSummary(igContents);
  const igTop = topContents(igContents, { limit: 3 });

  const s = detail.summary;
  const g = detail.growth;
  const cmp = detail.comparison;
  const periode = month ? labelBulan(month) : "sepanjang masa";
  // Konten diurut views utk menentukan TOP 3 (ditandai di tabel), lalu daftar penuh
  // ditampilkan urut tanggal.
  const byViews = [...(s.videos || [])].sort((a, b) => (Number(b.total_views) || 0) - (Number(a.total_views) || 0));
  const topRank = new Map(); // video_id -> peringkat 1..3
  byViews.slice(0, 3).forEach((v, idx) => topRank.set(v.video_id, idx + 1));
  const kontenList = [...(s.videos || [])].sort((a, b) => String(a.post_date).localeCompare(String(b.post_date)));
  const dibuat = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  let summaryText = ringkasanEksekutif({ account, periode, s, g, top: byViews[0], comparison: cmp });
  if (hasIg) {
    const igParts = [`Di Instagram, tercatat ${fmt(igSum.views || 0)} tayangan`];
    if (igCSum.count) igParts.push(`dari ${fmt(igCSum.count)} konten (ER ${igCSum.er == null ? "—" : `${igCSum.er}%`})`);
    if (igSum.new_followers != null) igParts.push(`dengan ${igSum.new_followers >= 0 ? "+" : ""}${fmt(igSum.new_followers)} follower baru`);
    summaryText += ` ${igParts.join(" ")}.`;
  }
  const MEDALI = { 1: "🥇", 2: "🥈", 3: "🥉" };

  const KPI = [
    { label: "Total Views", value: fmt(s.totalViews), bench: cmp?.totalViews },
    { label: "Total Konten", value: fmt(s.totalVideos), bench: cmp?.totalVideos },
    { label: "Engagement Rate", value: `${s.engagementRateOverall}%`, bench: cmp?.engagementRate },
    { label: "Net Follower", value: `${g.netGrowth >= 0 ? "+" : ""}${fmt(g.netGrowth)}`, bench: cmp?.netGrowth },
  ];

  return (
    <main className="relative z-10 mx-auto w-full max-w-4xl p-4 sm:p-6">
      {/* Toolbar (tidak ikut tercetak) */}
      <div className="no-print mb-4 flex flex-wrap items-center gap-3">
        <Link href="/report"><Button variant="ghost">← Laporan</Button></Link>
        <a href={`/api/report/excel?branch=${accountId}${month ? `&month=${month}` : ""}`}><Button variant="success">⬇️ Excel Bulanan</Button></a>
        <a href={`/api/report/weekly-excel?branch=${accountId}${month ? `&month=${month}` : ""}`}><Button variant="success">⬇️ Excel Mingguan</Button></a>
        <PrintButton />
        <div className="ml-auto"><MonthFilter months={detail.months} /></div>
      </div>

      <article className="card-3d print-tight bg-white p-6 sm:p-9">
        {/* Baris "created" di atas header */}
        <div className="mb-1 text-right text-[10px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-soft)" }}>created : Elio Digihub</div>

        {/* Header: logo Elio + judul + periode */}
        <header className="print-avoid mb-5 flex items-center gap-4 border-b pb-4" style={{ borderColor: "rgba(0,60,68,.15)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="Elio" width={50} height={50} style={{ width: 50, height: 50, borderRadius: 12, display: "block" }} />
          <div className="flex-1">
            <h1 className="text-lg font-extrabold tracking-tight text-ink sm:text-xl">Laporan Performa {hasIg ? "Media Sosial" : "TikTok"}</h1>
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>{account.nama_cabang} · @{account.tiktok_username}{hasIg ? " · TikTok + Instagram" : ""}</p>
          </div>
          <div className="text-right text-xs" style={{ color: "var(--ink-soft)" }}>
            <div className="text-sm font-bold" style={{ color: "var(--teal-900)" }}>{month ? labelBulan(month) : "Sepanjang masa"}</div>
            <div>Dibuat {dibuat}</div>
          </div>
        </header>

        {/* ===================== LAPORAN TIKTOK ===================== */}
        <div className="print-avoid mb-3 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(0,102,116,.08)" }}>
          <span className="text-base">🎵</span>
          <h2 className="text-sm font-extrabold uppercase tracking-wider" style={{ color: "var(--teal-900)" }}>Laporan TikTok</h2>
        </div>

        {/* KPI + perbandingan vs bulan lalu */}
        <section className="print-avoid mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {KPI.map((k) => (
            <div key={k.label} className="rounded-2xl p-3 text-center" style={{ background: "linear-gradient(160deg,#f1fbf3,#e3f4e8)" }}>
              <div className="text-lg font-extrabold text-ink">{k.value}</div>
              <div className="mb-0.5 text-[11px]" style={{ color: "var(--ink-soft)" }}>{k.label}</div>
              {cmp ? <Delta bench={k.bench} /> : null}
            </div>
          ))}
        </section>
        {cmp && <p className="mb-5 -mt-3 text-[10px]" style={{ color: "var(--ink-soft)" }}>▲▼ = perbandingan vs {labelBulan(cmp.prevMonth)}.</p>}

        {/* Target & Pencapaian TikTok — target bersifat BULANAN, jadi hanya tampil
            saat 1 bulan dipilih (angka pencapaian = data TikTok bulan itu). */}
        {month && goal && (goal.target_total_views || goal.target_engagement_rate || goal.target_net_followers) && (
          <section className="print-avoid mb-5">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--teal-900)" }}>Target &amp; Pencapaian TikTok — {labelBulan(month)}</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <ProgressBar label="Total Views" current={s.totalViews} target={goal.target_total_views} />
              <ProgressBar label="Engagement Rate" current={s.engagementRateOverall} target={goal.target_engagement_rate} suffix="%" />
              <ProgressBar label="Net Follower" current={g.netGrowth} target={goal.target_net_followers} />
            </div>
          </section>
        )}

        {/* Grafik ringkas */}
        <section className="print-avoid grid gap-5 sm:grid-cols-2">
          <div>
            <h2 className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--teal-900)" }}>Tren Follower</h2>
            <p className="mb-2 text-xs" style={{ color: "var(--ink-soft)" }}>{fmt(g.startFollowers)} → {fmt(g.endFollowers)} ({g.netGrowth >= 0 ? "+" : ""}{fmt(g.netGrowth)})</p>
            <LineChart data={detail.history.map((h) => ({ x: h.date, y: h.followers }))} height={140} />
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--teal-900)" }}>Audiens</h2>
              {detail.bestDayHour && (
                <p className="text-sm text-ink">🏆 Paling ramai: <b>{HARI[detail.bestDayHour.weekday]} {String(detail.bestDayHour.hour).padStart(2, "0")}:00</b></p>
              )}
              <p className="text-sm text-ink">👥 Penonton kembali: <b>{detail.viewers.returningPct}%</b> · baru {detail.viewers.newPct}%</p>
              {detail.gender && <p className="text-sm text-ink">⚧ Pria {Number(detail.gender.male_pct) || 0}% · Wanita {Number(detail.gender.female_pct) || 0}%</p>}
            </div>
            {detail.gender && (
              <Donut size={110} data={[
                { label: "Pria", value: Number(detail.gender.male_pct) || 0, color: "#2c5f9e" },
                { label: "Wanita", value: Number(detail.gender.female_pct) || 0, color: "#c85a8a" },
                { label: "Lainnya", value: Number(detail.gender.other_pct) || 0, color: "#93bcad" },
              ]} />
            )}
          </div>
        </section>

        {/* ===== HALAMAN 2 ===== */}
        <div className="print-break" />

        {/* Daftar Konten — SEMUA konten periode terpilih, urut tanggal, 3 teratas ditandai medali */}
        {kontenList.length > 0 && (
          <section className="print-avoid mb-5 mt-6">
            <h2 className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--teal-900)" }}>
              Daftar Konten{month ? ` — ${labelBulan(month)}` : ""} <span className="font-medium normal-case" style={{ color: "var(--ink-soft)" }}>({kontenList.length} video)</span>
            </h2>
            <p className="mb-2 text-[11px]" style={{ color: "var(--ink-soft)" }}>🥇🥈🥉 = 3 konten dengan views tertinggi periode ini.</p>
            <table className="w-full text-left text-sm">
              <thead>
                <tr style={{ color: "var(--ink-soft)" }}>
                  <th className="py-1 pr-2 font-medium">#</th>
                  <th className="py-1 pr-2 font-medium">Preview</th>
                  <th className="py-1 pr-2 font-medium">Tanggal</th>
                  {month && <th className="py-1 pr-2 font-medium">Minggu</th>}
                  <th className="py-1 pr-2 font-medium">Judul</th>
                  <th className="py-1 pr-2 font-medium text-right">Views</th>
                  <th className="py-1 pr-2 font-medium text-right">Likes</th>
                  <th className="py-1 pr-2 font-medium text-right">Kom.</th>
                  <th className="py-1 pr-2 font-medium text-right">Share</th>
                  <th className="py-1 pr-2 font-medium text-right">ER</th>
                </tr>
              </thead>
              <tbody>
                {kontenList.map((v, i) => {
                  const rank = topRank.get(v.video_id);
                  return (
                    <tr key={v.video_id || i} className="border-t align-top" style={{ borderColor: "rgba(0,60,68,.08)", background: rank ? "rgba(240,180,90,.10)" : undefined }}>
                      <td className="py-1 pr-2 text-center">{rank ? <span title={`Top ${rank} views`}>{MEDALI[rank]}</span> : <span style={{ color: "var(--ink-soft)" }}>{i + 1}</span>}</td>
                      <td className="py-1 pr-2"><Thumbnail link={v.video_link} width={38} height={50} /></td>
                      <td className="whitespace-nowrap py-1 pr-2" style={{ color: "var(--ink-soft)" }}>{v.post_date ? tglPanjang(v.post_date).replace(/ \d{4}$/, "") : "—"}</td>
                      {month && <td className="whitespace-nowrap py-1 pr-2" style={{ color: "var(--ink-soft)" }}>M{weekOfMonth(Number(String(v.post_date).slice(8, 10)))}</td>}
                      <td className="py-1 pr-2 text-ink">
                        {v.video_link
                          ? <a href={v.video_link} target="_blank" rel="noopener noreferrer" className="line-clamp-2 max-w-xs hover:underline" style={{ color: rank ? "#8a5a12" : "var(--teal-900)" }}>{v.video_title || "(tanpa judul)"}</a>
                          : <span className="line-clamp-2 max-w-xs">{v.video_title || "(tanpa judul)"}</span>}
                      </td>
                      <td className="py-1 pr-2 text-right font-medium">{fmt(v.total_views)}</td>
                      <td className="py-1 pr-2 text-right">{fmt(v.total_likes)}</td>
                      <td className="py-1 pr-2 text-right">{fmt(v.total_comments)}</td>
                      <td className="py-1 pr-2 text-right">{fmt(v.total_shares)}</td>
                      <td className="py-1 pr-2 text-right">{v.engagement_rate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {/* Rincian Mingguan (saat 1 bulan dipilih) */}
        {detail.weekly && (
          <section className="print-avoid mb-5">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--teal-900)" }}>Rincian Mingguan</h2>
            <table className="w-full text-left text-sm">
              <thead>
                <tr style={{ color: "var(--ink-soft)" }}>
                  <th className="py-1 pr-3 font-medium">Minggu</th>
                  <th className="py-1 pr-3 font-medium">Tanggal</th>
                  <th className="py-1 pr-3 font-medium text-right">Konten</th>
                  <th className="py-1 pr-3 font-medium text-right">Views</th>
                  <th className="py-1 pr-3 font-medium text-right">ER</th>
                  <th className="py-1 pr-3 font-medium text-right">Net Follower</th>
                  <th className="py-1 pr-3 font-medium text-right">Follower Akhir</th>
                </tr>
              </thead>
              <tbody>
                {detail.weekly.content.map((c, i) => {
                  const f = detail.weekly.follower[i] || {};
                  const wk = detail.weekly.weeks[i] || {};
                  const net = Number(f.netGrowth) || 0;
                  return (
                    <tr key={c.week} className="border-t" style={{ borderColor: "rgba(0,60,68,.08)" }}>
                      <td className="py-1 pr-3 font-medium text-ink">{c.label}</td>
                      <td className="whitespace-nowrap py-1 pr-3" style={{ color: "var(--ink-soft)" }}>{wk.rangeLabel || "—"}</td>
                      <td className="py-1 pr-3 text-right">{fmt(c.count)}</td>
                      <td className="py-1 pr-3 text-right">{fmt(c.views)}</td>
                      <td className="py-1 pr-3 text-right">{c.engagementRate}%</td>
                      <td className="py-1 pr-3 text-right" style={net < 0 ? { color: "#b91c1c", fontWeight: 600 } : net > 0 ? { color: "#166534" } : undefined}>{net > 0 ? "+" : ""}{fmt(net)}</td>
                      <td className="py-1 pr-3 text-right">{f.endFollowers != null ? fmt(f.endFollowers) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {/* ===================== LAPORAN INSTAGRAM ===================== */}
        {hasIg && (
          <>
            <div className="print-avoid mb-3 mt-6 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(193,53,132,.09)" }}>
              <span className="text-base">📸</span>
              <h2 className="text-sm font-extrabold uppercase tracking-wider" style={{ color: "#a12472" }}>Laporan Instagram</h2>
            </div>
            <section className="print-avoid mb-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  ["Tayangan", igSum.views],
                  ["Jangkauan", igSum.reach],
                  ["Kunjungan profil", igSum.profile_visits],
                  ["Follower baru", igSum.new_followers == null ? null : `${igSum.new_followers >= 0 ? "+" : ""}${fmt(igSum.new_followers)}`],
                  ["ER akun", igCSum.er == null ? null : `${igCSum.er}%`],
                ].map(([label, val]) => (
                  <div key={label} className="rounded-2xl p-3 text-center" style={{ background: "linear-gradient(160deg,#fdf0f6,#f7e3ef)" }}>
                    <div className="text-lg font-extrabold text-ink">{val == null ? "—" : typeof val === "string" ? val : fmt(val)}</div>
                    <div className="text-[11px]" style={{ color: "var(--ink-soft)" }}>{label}</div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px]" style={{ color: "var(--ink-soft)" }}>
                Sumber: Meta Business Suite{month ? ` — ${labelBulan(month)}` : ""}. Tayangan mencakup semua jenis konten termasuk Story. {fmt(igCSum.count)} konten pada periode ini{igCSum.follows ? `, ${igCSum.follows >= 0 ? "+" : ""}${fmt(igCSum.follows)} follower datang dari konten` : ""}.
              </p>

              {/* Target & Pencapaian Instagram — bulanan; hanya saat 1 bulan dipilih. */}
              {month && goalIg && (goalIg.target_total_views || goalIg.target_engagement_rate || goalIg.target_net_followers) && (
                <div className="mt-4">
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: "#a12472" }}>Target &amp; Pencapaian Instagram — {labelBulan(month)}</h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <ProgressBar label="Tayangan" current={igSum.views || 0} target={goalIg.target_total_views} />
                    <ProgressBar label="Engagement Rate" current={igCSum.er || 0} target={goalIg.target_engagement_rate} suffix="%" />
                    <ProgressBar label="Follower Baru" current={igSum.new_followers || 0} target={goalIg.target_net_followers} />
                  </div>
                </div>
              )}
              {igTop.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>Konten teratas (by tayangan):</p>
                  <ol className="flex flex-col gap-0.5 text-sm text-ink">
                    {igTop.map((c, i) => (
                      <li key={c.post_id} className="flex items-baseline gap-2">
                        <span style={{ color: "var(--ink-soft)" }}>{i + 1}.</span>
                        {c.permalink
                          ? <a href={c.permalink} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate hover:underline" style={{ color: "var(--teal-900)" }}>{(c.description || "(tanpa caption)").split("\n")[0]}</a>
                          : <span className="min-w-0 flex-1 truncate">{(c.description || "(tanpa caption)").split("\n")[0]}</span>}
                        <span className="whitespace-nowrap font-medium">{fmt(c.views)} views{c.er != null ? ` · ER ${c.er}%` : ""}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </section>
          </>
        )}

        {/* ===================== KESIMPULAN ===================== */}
        <div className="print-avoid mb-3 mt-6 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(0,102,116,.08)" }}>
          <span className="text-base">📝</span>
          <h2 className="text-sm font-extrabold uppercase tracking-wider" style={{ color: "var(--teal-900)" }}>Kesimpulan</h2>
        </div>
        <section className="print-avoid mb-5">
          <p className="mb-3 rounded-xl p-3 text-sm leading-relaxed text-ink" style={{ background: "rgba(0,102,116,.05)" }}>{summaryText}</p>
          <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--teal-900)" }}>Rekomendasi</h3>
          <ul className="flex flex-col gap-1.5">
            {(detail.insights || []).map((i, idx) => (
              <li key={idx} className="flex gap-2 text-sm text-ink">
                <span style={{ color: "var(--teal-900)" }}>›</span>
                <span><b>{i.aspek}:</b> {i.saran}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Footer metodologi */}
        <footer className="mt-6 border-t pt-3 text-[10px] leading-relaxed" style={{ borderColor: "rgba(0,60,68,.15)", color: "var(--ink-soft)" }}>
          Sumber data: TikTok Studio (Analytics){hasIg ? " & Meta Business Suite (Instagram)" : ""}. Periode data terakhir: {tglPanjang(detail.latestDataDate)}.
          Laporan dibuat otomatis oleh <b>Elio Digihub</b> pada {dibuat}. Angka views bersifat akumulatif s/d tanggal tarik data.
        </footer>
      </article>
    </main>
  );
}
