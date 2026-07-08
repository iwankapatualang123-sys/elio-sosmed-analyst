// File: app/calendar/page.jsx
// Content Calendar (blueprint 21A): kalender bulanan kapan video di-post + performa
// per tanggal, per cabang. Server Component + RLS.

import { getCurrentProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import DataFilters from "@/components/DataFilters";
import ContentCalendar from "@/components/ContentCalendar";

const monthOf = (d) => (typeof d === "string" ? d.slice(0, 7) : null);

export default async function CalendarPage({ searchParams }) {
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

  let content = [];
  if (selectedId) {
    const { data } = await supabase.from("tiktok_content").select("post_date, total_views, video_title").eq("tiktok_account_id", selectedId);
    content = data || [];
  }

  const months = [...new Set(content.map((r) => monthOf(r.post_date)).filter(Boolean))].sort().reverse();
  const validMonth = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : null;
  const selectedMonth = validMonth || months[0] || new Date().toISOString().slice(0, 7);
  const [year, month] = selectedMonth.split("-").map(Number);

  // Kelompokkan konten per hari pada bulan terpilih.
  const dayData = {};
  for (const r of content) {
    if (monthOf(r.post_date) !== selectedMonth) continue;
    const day = Number(r.post_date.slice(8, 10));
    if (!dayData[day]) dayData[day] = { count: 0, views: 0, titles: [] };
    dayData[day].count += 1;
    dayData[day].views += Number(r.total_views) || 0;
    if (dayData[day].titles.length < 5) dayData[day].titles.push(String(r.video_title || "").slice(0, 40));
  }

  return (
    <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-5 p-4 sm:p-6">
      <Nav email={profile.email} role={profile.role} />
      <div className="px-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-sm sm:text-3xl">Kalender Konten</h1>
        <p className="mt-0.5 text-sm" style={{ color: "rgba(255,255,255,.75)" }}>Kapan video di-post & performanya per tanggal</p>
      </div>

      <DataFilters branches={branches || []} months={months} selectedBranch={selectedId} selectedMonth={selectedMonth} basePath="/calendar" />

      <section className="card-3d p-4 sm:p-5">
        {content.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Belum ada konten untuk cabang ini.</p>
        ) : (
          <ContentCalendar year={year} month={month} dayData={dayData} />
        )}
      </section>
    </main>
  );
}
