// File: app/dashboard/page.jsx
// Dashboard ▸ UMUM — ringkasan SEMUA outlet & SEMUA platform (TikTok+Instagram+
// Threads). Server Component. Detail per-outlet ada di route platform (tiktok/
// instagram/threads). Data agregat dari lib/dashboard/umum.js; ranking gabungan
// memakai ulang loadPortfolio + loadPortfolioInstagram (sudah teruji).

import { getCurrentProfile } from "@/lib/auth";
import { createReadClient } from "@/lib/db-compat";
import { loadUmum } from "@/lib/dashboard/umum";
import { loadPortfolio, loadPortfolioInstagram } from "@/lib/tiktok/analytics";
import Nav from "@/components/Nav";
import MonthFilter from "@/components/MonthFilter";
import MetricCard from "@/components/MetricCard";
import { LineChart } from "@/components/Charts";
import FollowerGroupBars from "@/components/umum/FollowerGroupBars";
import TopKonten from "@/components/umum/TopKonten";
import UmumCatFilter from "@/components/umum/UmumCatFilter";

const BULAN_NAMA = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
function labelBulan(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  return `${BULAN_NAMA[Number(m) - 1] || m} ${y}`;
}
function labelBulanSingkat(ym) {
  const [y, m] = String(ym).split("-");
  return `${["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][Number(m) - 1] || m} ${String(y).slice(2)}`;
}
const fmt = (n) => Number(n || 0).toLocaleString("id-ID");
function ringkas(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })}Jt`;
  if (v >= 1_000) return `${(v / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}rb`;
  return fmt(v);
}

const STATUS_STYLE = {
  naik: { background: "#dcfce7", color: "#166534" },
  stabil: { background: "#fef9c3", color: "#854d0e" },
  turun: { background: "#fee2e2", color: "#991b1b" },
};

export default async function UmumPage({ searchParams }) {
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
  const sp = (await searchParams) || {};
  const selectedMonth = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : null;

  const umum = await loadUmum(supabase, { month: selectedMonth, cat: sp.cat || null });
  const catFilter = umum.categories.includes(sp.cat) ? sp.cat : null;

  // Ranking gabungan (TikTok + Instagram) per outlet — pakai ulang portofolio teruji.
  const ttData = await loadPortfolio(supabase, { month: selectedMonth });
  const igData = await loadPortfolioInstagram(supabase, { month: selectedMonth });
  const months = ttData.months || [];
  const igById = new Map(igData.branches.map((b) => [b.id, b]));
  const rankingAll = ttData.branches
    .filter((b) => !catFilter || b.kategori === catFilter)
    .map((tt) => {
      const ig = igById.get(tt.id) || {};
      const tayangan = (tt.totalViews || 0) + (ig.totalViews || 0);
      const eng = (tt.totalEngagement || 0) + (ig.totalEngagement || 0);
      const net = (tt.netFollowerGrowth || 0) + (ig.netFollowerGrowth || 0);
      return {
        id: tt.id,
        nama: tt.nama_cabang,
        kategori: tt.kategori || "-",
        konten: (tt.totalContent || 0) + (ig.totalContent || 0),
        tayangan,
        er: tayangan > 0 ? Math.round((eng / tayangan) * 10000) / 100 : 0,
        net,
        status: net > 0 ? "naik" : net < 0 ? "turun" : "stabil",
      };
    })
    .sort((a, b) => b.tayangan - a.tayangan);

  const k = umum.kpi;
  const chipAll = "Semua platform";
  const platformChip = [k.platforms.tiktok && "TT", k.platforms.instagram && "IG", k.platforms.threads && "TH"].filter(Boolean).join(" + ") || "—";

  // Deret tren tayangan multi-garis (hanya platform yang punya data).
  const trendSeries = [
    umum.viewsTrend.tiktok.some((p) => p.y > 0) && { label: "TikTok", color: "#111111", data: umum.viewsTrend.tiktok.map((p) => ({ x: labelBulanSingkat(p.x), y: p.y })) },
    umum.viewsTrend.instagram.some((p) => p.y > 0) && { label: "Instagram", color: "#c13584", data: umum.viewsTrend.instagram.map((p) => ({ x: labelBulanSingkat(p.x), y: p.y })) },
  ].filter(Boolean);

  return (
    <main className="relative z-10 mx-auto grid3 min-h-screen w-full max-w-6xl p-4 sm:p-6">
      <Nav email={profile.email} role={profile.role} />

      {/* Hero */}
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">Ringkasan Umum</h1>
          <p className="mt-0.5 text-sm" style={{ color: "var(--on-bg-soft)" }}>
            Semua platform &amp; semua outlet{selectedMonth ? ` · ${labelBulan(selectedMonth)}` : " · sepanjang masa"}
          </p>
        </div>
        <MonthFilter months={months} />
      </div>

      {/* Filter kategori */}
      <div className="flex flex-wrap items-center gap-3 px-1">
        {umum.categories.length > 0 && <UmumCatFilter categories={umum.categories} value={catFilter} />}
        <span className="text-xs" style={{ color: "var(--ink-soft)" }}>
          {umum.outletCount} outlet{catFilter ? ` · kategori ${catFilter}` : ""}
        </span>
      </div>

      {/* KPI */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard icon="🏢" accent="indigo" label="Outlet aktif" value={fmt(k.outletAktif)} />
        <MetricCard icon="👁️" accent="blue" label="Total tayangan" value={ringkas(k.totalViews)} chip={chipAll} />
        <MetricCard icon="💬" accent="green" label="Avg engagement rate" value={`${k.avgEr}%`} chip={chipAll} />
        <MetricCard icon="👥" accent="violet" label="Total follower" value={ringkas(k.totalFollower)} chip={platformChip} />
      </section>

      {/* Follower per outlet + Tren tayangan */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card-3d p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-ink">Perbandingan Follower per Outlet</h3>
          <p className="mb-1 text-[11px]" style={{ color: "var(--ink-soft)" }}>
            Batang bertambah otomatis saat outlet punya data di platform lain. {umum.followerBars.length >= 6 ? "Menampilkan 6 outlet teratas." : ""}
          </p>
          <FollowerGroupBars outlets={umum.followerBars} />
        </div>

        <div className="card-3d p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-ink">Tren Tayangan per Platform</h3>
          <p className="mb-2 text-[11px]" style={{ color: "var(--ink-soft)" }}>Total tayangan bulanan (maks. 6 bulan terakhir), satu garis per platform aktif.</p>
          {trendSeries.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Belum ada data tayangan.</p>
          ) : (
            <>
              <LineChart series={trendSeries} />
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: "var(--ink-soft)" }}>
                {trendSeries.map((s) => (
                  <span key={s.label} className="inline-flex items-center gap-1.5">
                    <i style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, display: "inline-block" }} />{s.label}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Demografi + Top Pillars */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card-3d p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-ink">Demografi Audiens</h3>
            <span className="ml-auto rounded-full px-2 py-0.5 text-[9.5px] font-bold" style={{ background: "#ececec", color: "#333" }}>Sumber: TikTok</span>
          </div>
          {umum.demographics ? (
            <>
              <p className="mb-3 text-[11px]" style={{ color: "var(--ink-soft)" }}>
                Rata-rata {umum.demographics.outletsCounted} outlet. Gender &amp; wilayah hanya tersedia dari TikTok Analytics.
              </p>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Gender</p>
                  {[["Wanita", umum.demographics.female, "#c13584"], ["Pria", umum.demographics.male, "#5b63eb"], ...(umum.demographics.other > 0 ? [["Lainnya", umum.demographics.other, "#93bcad"]] : [])].map(([lbl, v, c]) => (
                    <div key={lbl} className="mb-2 flex items-center gap-2">
                      <span className="w-14 text-[11px]" style={{ color: "var(--ink-soft)" }}>{lbl}</span>
                      <span className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: "#f0f1f6" }}>
                        <span className="block h-full rounded-full" style={{ width: `${Math.min(100, v)}%`, background: c }} />
                      </span>
                      <span className="w-9 text-right text-[11px] font-bold text-ink">{v}%</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Top Wilayah</p>
                  {umum.demographics.territories.length === 0 ? (
                    <p className="text-[11px]" style={{ color: "var(--ink-soft)" }}>—</p>
                  ) : umum.demographics.territories.map((t, i) => (
                    <div key={t.code} className="mb-2 flex items-center gap-2">
                      <span className="w-16 truncate text-[11px]" style={{ color: "var(--ink-soft)" }} title={t.code}>{t.code}</span>
                      <span className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: "#f0f1f6" }}>
                        <span className="block h-full rounded-full" style={{ width: `${Math.min(100, t.pct)}%`, background: ["#5b63eb", "#6b73f0", "#8b90f4", "#aab0f8"][i] || "#aab0f8" }} />
                      </span>
                      <span className="w-9 text-right text-[11px] font-bold text-ink">{t.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>Belum ada snapshot demografi TikTok dari outlet mana pun.</p>
          )}
        </div>

        <div className="card-3d p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-ink">Top Pillars</h3>
            <span className="ml-auto text-[11px]" style={{ color: "var(--ink-soft)" }}>rata-rata semua outlet</span>
          </div>
          <p className="mb-2 text-[11px]" style={{ color: "var(--ink-soft)" }}>Pillar konten (dari Rencana) dengan performa terbaik — dicocokkan ke konten yang sudah tayang.</p>
          {umum.topPillars.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Belum ada konten tayang yang tertaut ke pillar. Isi <b>pillar</b> &amp; <b>link tayang</b> di Rencana agar muncul di sini.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr style={{ color: "var(--ink-soft)" }}>
                    <th className="py-2 pr-3 text-[11px] font-medium">Pillar</th>
                    <th className="py-2 pr-3 text-right text-[11px] font-medium">Konten</th>
                    <th className="py-2 pr-3 text-right text-[11px] font-medium">Avg Views</th>
                    <th className="py-2 pr-3 text-right text-[11px] font-medium">Avg ER</th>
                  </tr>
                </thead>
                <tbody>
                  {umum.topPillars.map((p) => (
                    <tr key={p.pillar} className="border-t" style={{ borderColor: "#f1f2f7" }}>
                      <td className="py-2 pr-3 font-semibold text-ink">{p.pillar}</td>
                      <td className="py-2 pr-3 text-right" style={{ color: "var(--ink-soft)" }}>{fmt(p.count)}</td>
                      <td className="py-2 pr-3 text-right font-semibold text-ink">{ringkas(p.avgViews)}</td>
                      <td className="py-2 pr-3 text-right">
                        <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={STATUS_STYLE.naik}>{p.avgEr == null ? "—" : `${p.avgEr}%`}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Top Konten */}
      <TopKonten byViews={umum.topKonten.byViews} byEr={umum.topKonten.byEr} hasEr={umum.topKonten.hasEr} />

      {/* Ranking outlet gabungan */}
      <section className="card-3d p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-ink">Ranking Outlet</h3>
          <span className="ml-auto text-[11px]" style={{ color: "var(--ink-soft)" }}>gabungan semua platform</span>
        </div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr style={{ color: "var(--ink-soft)" }}>
                <th className="py-2 pr-3 text-[11px] font-medium">#</th>
                <th className="py-2 pr-3 text-[11px] font-medium">Outlet</th>
                <th className="py-2 pr-3 text-[11px] font-medium">Kategori</th>
                <th className="py-2 pr-3 text-right text-[11px] font-medium">Konten</th>
                <th className="py-2 pr-3 text-right text-[11px] font-medium">Tayangan</th>
                <th className="py-2 pr-3 text-right text-[11px] font-medium">Eng. rate</th>
                <th className="py-2 pr-3 text-right text-[11px] font-medium">Follower Δ</th>
                <th className="py-2 pr-3 text-[11px] font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rankingAll.map((o, i) => (
                <tr key={o.id} className="border-t" style={{ borderColor: "#f1f2f7" }}>
                  <td className="py-2 pr-3">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-extrabold" style={{ background: "var(--pri-50)", color: "var(--teal-900)" }}>{i + 1}</span>
                  </td>
                  <td className="py-2 pr-3 font-semibold text-ink">{o.nama}</td>
                  <td className="py-2 pr-3" style={{ color: "var(--ink-soft)" }}>{o.kategori}</td>
                  <td className="py-2 pr-3 text-right">{fmt(o.konten)}</td>
                  <td className="py-2 pr-3 text-right font-semibold text-ink">{ringkas(o.tayangan)}</td>
                  <td className="py-2 pr-3 text-right">{o.er}%</td>
                  <td className="py-2 pr-3 text-right font-semibold" style={{ color: o.net > 0 ? "#166534" : o.net < 0 ? "#991b1b" : "var(--ink-soft)" }}>{o.net >= 0 ? `+${fmt(o.net)}` : fmt(o.net)}</td>
                  <td className="py-2 pr-3"><span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={STATUS_STYLE[o.status]}>{o.status}</span></td>
                </tr>
              ))}
              {rankingAll.length === 0 && (
                <tr><td colSpan={8} className="py-6 text-center" style={{ color: "var(--ink-soft)" }}>Belum ada outlet untuk kategori ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
