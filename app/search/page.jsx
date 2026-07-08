// File: app/search/page.jsx
// Hasil pencarian global (blueprint 21E): cari cabang (nama/username) & video
// (judul) lintas cabang yang boleh diakses (RLS). Server Component.

import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";

const fmt = (n) => Number(n || 0).toLocaleString("id-ID");

export default async function SearchPage({ searchParams }) {
  const profile = await getCurrentProfile();
  if (!profile?.role) {
    return (
      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 p-6">
        <Nav email={profile?.email} role={profile?.role} />
        <section className="card-3d p-6"><p className="text-sm" style={{ color: "var(--ink-soft)" }}>Hubungi admin untuk mengaktifkan akses.</p></section>
      </main>
    );
  }

  const sp = (await searchParams) || {};
  const query = String(sp.q || "").trim();
  const safe = query.replace(/[,()%]/g, " ").trim(); // sanitasi untuk filter ilike/or

  let branches = [];
  let videos = [];
  if (safe) {
    const supabase = await createSupabaseServerClient();
    const [b, v] = await Promise.all([
      supabase.from("tiktok_accounts").select("id, nama_cabang, tiktok_username")
        .or(`nama_cabang.ilike.%${safe}%,tiktok_username.ilike.%${safe}%`).limit(15),
      supabase.from("tiktok_content").select("video_id, video_title, video_link, total_views, post_date, tiktok_accounts(nama_cabang)")
        .ilike("video_title", `%${safe}%`).order("total_views", { ascending: false }).limit(40),
    ]);
    branches = b.data || [];
    videos = v.data || [];
  }

  return (
    <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-5 p-4 sm:p-6">
      <Nav email={profile.email} role={profile.role} />

      <div className="px-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-sm sm:text-3xl">Pencarian</h1>
        <p className="mt-0.5 text-sm" style={{ color: "rgba(255,255,255,.75)" }}>
          {query ? `Hasil untuk "${query}" — ${branches.length} cabang, ${videos.length} video` : "Ketik kata kunci di kotak pencarian header."}
        </p>
      </div>

      {query && (
        <>
          <section className="card-3d p-4 sm:p-5">
            <h2 className="mb-3 text-base font-semibold text-ink">Cabang ({branches.length})</h2>
            {branches.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Tidak ada cabang cocok.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {branches.map((b) => (
                  <Link key={b.id} href={`/dashboard?branch=${b.id}`}
                    className="rounded-full px-3 py-1.5 text-sm font-medium" style={{ background: "rgba(0,102,116,.1)", color: "var(--teal-900)" }}>
                    {b.nama_cabang}{b.tiktok_username ? ` @${b.tiktok_username}` : ""}
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="card-3d p-4 sm:p-5">
            <h2 className="mb-3 text-base font-semibold text-ink">Video ({videos.length})</h2>
            {videos.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Tidak ada video cocok.</p>
            ) : (
              <ul className="flex flex-col divide-y" style={{ borderColor: "rgba(0,60,68,.1)" }}>
                {videos.map((v) => (
                  <li key={v.video_id} className="flex items-center gap-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 text-sm text-ink" title={v.video_title}>{v.video_title || "(tanpa judul)"}</span>
                      <span className="text-xs" style={{ color: "var(--ink-soft)" }}>
                        {v.tiktok_accounts?.nama_cabang || "-"} · {v.post_date || "-"}
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-sm font-semibold text-ink">{fmt(v.total_views)} views</span>
                    {v.video_link && (
                      <a href={v.video_link} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold" style={{ color: "var(--teal-900)" }}>Buka ↗</a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
