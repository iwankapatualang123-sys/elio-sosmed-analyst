// File: components/Nav.jsx
// Navigasi atas (client). Header bar teal glossy: brand + menu utama + pencarian +
// menu profil (dropdown untuk Akun/Pengaturan/Log/Keluar) agar tidak sesak.
// Blueprint bagian 11 & 23.

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, UploadCloud, Database, CalendarDays, Settings, UserRound, ScrollText, LogOut, ChevronDown } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import GlobalSearch from "@/components/GlobalSearch";
import IdleLogout from "@/components/IdleLogout";

const PRIMARY = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/data", label: "Data", Icon: Database },
  { href: "/calendar", label: "Kalender", Icon: CalendarDays },
  { href: "/upload", label: "Upload", Icon: UploadCloud },
];

export default function Nav({ email, role }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const isActive = (href) => pathname === href || pathname.startsWith(`${href}/`);

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const menuItems = [
    { href: "/account", label: "Akun", Icon: UserRound },
    ...(role === "admin" ? [
      { href: "/settings", label: "Pengaturan", Icon: Settings },
      { href: "/activity", label: "Log Aktivitas", Icon: ScrollText },
    ] : []),
  ];

  return (
    <header
      className="flex flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2.5 sm:px-5"
      style={{
        background: "linear-gradient(115deg,#00434b 0%,#006674 55%,#0a8291 100%)",
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,.16)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.28), 0 16px 34px -12px rgba(0,36,42,.65), 0 4px 10px -6px rgba(0,36,42,.5)",
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 pr-1">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-2xl text-base font-extrabold text-white"
          style={{ background: "linear-gradient(160deg,#7fe0d0,#0a8291 55%,#00434b)", boxShadow: "0 0 0 2px rgba(255,255,255,.18), 0 6px 14px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.5)" }}
        >
          E
        </div>
        <div className="hidden leading-none md:block">
          <div className="text-sm font-bold tracking-tight text-white">Elio Analyst</div>
          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-widest" style={{ color: "rgba(255,255,255,.55)" }}>TikTok Analytics</div>
        </div>
      </div>

      {/* Menu utama */}
      <nav className="flex items-center gap-1">
        {PRIMARY.map((l) => {
          const active = isActive(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-semibold transition-all"
              style={active
                ? { background: "linear-gradient(180deg,#ffffff,#eef8f1)", color: "var(--teal-900)", boxShadow: "0 4px 12px rgba(0,0,0,.22), inset 0 1px 0 #fff" }
                : { color: "rgba(255,255,255,.82)" }}
            >
              <l.Icon size={18} strokeWidth={2.2} aria-hidden />
              <span className="hidden lg:inline">{l.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Kanan: pencarian + menu profil */}
      <div className="ml-auto flex items-center gap-2">
        <div className="hidden md:block"><GlobalSearch /></div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 text-white transition-colors"
            style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.18)" }}
            aria-label="Menu akun"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold" style={{ background: "linear-gradient(180deg,#7fe0d0,#00545e)" }}>
              {(email || "?").charAt(0).toUpperCase()}
            </span>
            <span className="hidden max-w-[120px] truncate text-xs lg:inline">{email}</span>
            <ChevronDown size={15} aria-hidden />
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-2xl" style={{ background: "#fff", boxShadow: "0 18px 40px -12px rgba(0,60,68,.5)", border: "1px solid rgba(0,60,68,.1)" }}>
                <div className="border-b px-3 py-2" style={{ borderColor: "rgba(0,60,68,.08)" }}>
                  <div className="truncate text-sm font-semibold text-ink">{email}</div>
                  {role && <div className="text-xs" style={{ color: "var(--ink-soft)" }}>{role}</div>}
                </div>
                {menuItems.map((m) => (
                  <Link key={m.href} href={m.href} onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-[rgba(0,102,116,.06)]">
                    <m.Icon size={16} aria-hidden /> {m.label}
                  </Link>
                ))}
                <button type="button" onClick={handleLogout} className="flex w-full items-center gap-2 border-t px-3 py-2 text-sm text-red-600 hover:bg-red-50" style={{ borderColor: "rgba(0,60,68,.08)" }}>
                  <LogOut size={16} aria-hidden /> Keluar
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <IdleLogout />
    </header>
  );
}
