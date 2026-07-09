// File: app/content-plan/page.jsx
// Halaman Rencana Konten (Content Plan) — meniru sheet Excel "Content Plan": kalender
// editorial produksi konten per cabang (PIC, hook, pillar, goals, approval). Status
// Uploaded/WIP dihitung otomatis dgn mencocokkan Headline/Hook ke konten yang sudah
// tayang di tiktok_content. Server Component + RLS.

import { getCurrentProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import DataFilters from "@/components/DataFilters";
import ContentPlanBoard from "@/components/ContentPlanBoard";
import {
  matchPlanStatus, summarizePlans,
  GOALS_OPTIONS, PILLAR_OPTIONS, TYPE_OPTIONS,
} from "@/lib/tiktok/content-plan";

export default async function ContentPlanPage({ searchParams }) {
  const profile = await getCurrentProfile();
  if (!profile?.role) {
    return (
      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 p-6">
        <Nav email={profile?.email} role={profile?.role} />
        <section className="card-3d p-6"><p className="text-sm" style={{ color: "var(--ink-soft)" }}>Hubungi admin untuk mengaktifkan akses.</p></section>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: branches } = await supabase
    .from("tiktok_accounts").select("id, nama_cabang, tiktok_username").eq("is_active", true).order("nama_cabang");
  const sp = (await searchParams) || {};
  const selectedId = sp.branch || branches?.[0]?.id || null;

  let plansRaw = [];
  let contents = [];
  if (selectedId) {
    const [{ data: pl }, { data: ct }] = await Promise.all([
      supabase.from("content_plans").select("*").eq("tiktok_account_id", selectedId).order("post_date", { ascending: true, nullsFirst: false }),
      supabase.from("tiktok_content").select("video_id, video_title, video_link, post_date").eq("tiktok_account_id", selectedId),
    ]);
    plansRaw = pl || [];
    contents = ct || [];
  }

  // Bulan-bulan yang ada rencananya (untuk filter). plan_month = 'YYYY-MM-01'.
  const months = [...new Set(plansRaw.map((p) => (p.plan_month || "").slice(0, 7)).filter(Boolean))].sort().reverse();
  const selectedMonth = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : "all";

  // Hitung status otomatis tiap baris, lalu filter bulan bila dipilih.
  const withStatus = plansRaw.map((p) => {
    const r = matchPlanStatus(p, contents);
    return { ...p, status: r.status, match: r.match, hint: r.hint };
  });
  const filtered = selectedMonth === "all" ? withStatus : withStatus.filter((p) => (p.plan_month || "").slice(0, 7) === selectedMonth);

  const kpi = summarizePlans(filtered.map((p) => p.status));
  const accCount = filtered.filter((p) => p.acc_to_posting).length;

  // Daftar PIC unik untuk datalist form.
  const pics = [...new Set(plansRaw.map((p) => p.pic).filter(Boolean))].sort();

  const cards = [
    { label: "Total rencana", value: kpi.total, fg: "var(--teal-900)" },
    { label: "Verified", value: kpi.verified, fg: "#166534" },
    { label: "Not verified", value: kpi.notVerified, fg: "#b45309" },
    { label: "Sudah ACC", value: accCount, fg: "var(--teal-900)" },
  ];

  return (
    <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <Nav email={profile.email} role={profile.role} />

      <div className="px-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-sm sm:text-3xl">Rencana Konten</h1>
        <p className="mt-0.5 text-sm" style={{ color: "rgba(255,255,255,.75)" }}>
          Kalender produksi konten per cabang — tempel link tayang & status jadi <b>Verified</b> saat cocok dengan data report TikTok.
        </p>
      </div>

      <DataFilters branches={branches || []} months={months} selectedBranch={selectedId} selectedMonth={selectedMonth} basePath="/content-plan" />

      {!selectedId ? (
        <section className="card-3d p-6"><p className="text-sm" style={{ color: "var(--ink-soft)" }}>Belum ada cabang aktif.</p></section>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {cards.map((c) => (
              <div key={c.label} className="card-3d p-4">
                <div className="text-2xl font-extrabold" style={{ color: c.fg }}>{c.value}</div>
                <div className="mt-0.5 text-xs font-medium" style={{ color: "var(--ink-soft)" }}>{c.label}</div>
              </div>
            ))}
          </div>

          <section className="card-3d p-4 sm:p-5">
            <ContentPlanBoard
              accountId={selectedId}
              plans={filtered}
              options={{ goals: GOALS_OPTIONS, pillars: PILLAR_OPTIONS, types: TYPE_OPTIONS }}
              pics={pics}
            />
          </section>
        </>
      )}
    </main>
  );
}
