// File: components/Nav.jsx
// Navigasi aplikasi (client) — gaya tool analitik agency: SIDEBAR KIRI tetap di
// desktop (brand + pencarian + menu + profil), TOPBAR tipis + BOTTOM-NAV di HP.
// Offset konten diatur di globals.css (main.grid3 padding saat sidebar/topbar ada).

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, UploadCloud, Database, CalendarDays, ClipboardList, FileText, Settings, UserRound, ScrollText, LogOut, ChevronDown, Music2, Camera, AtSign, LayoutGrid } from "lucide-react";
import GlobalSearch from "@/components/GlobalSearch";
import IdleLogout from "@/components/IdleLogout";
import InfoRail from "@/components/InfoRail";

const PRIMARY = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/data", label: "Data", Icon: Database },
  { href: "/report", label: "Laporan", Icon: FileText },
  { href: "/content-plan", label: "Rencana", Icon: ClipboardList },
  { href: "/calendar", label: "Kalender", Icon: CalendarDays },
  { href: "/upload", label: "Upload", Icon: UploadCloud },
];

// Sub-menu Dashboard per platform. Umum = ringkasan semua platform & outlet;
// sisanya = detail per outlet dengan tab platform terbuka.
const DASH_SUB = [
  { href: "/dashboard", label: "Umum", Icon: LayoutGrid, exact: true },
  { href: "/dashboard/instagram", label: "Instagram", Icon: Camera },
  { href: "/dashboard/tiktok", label: "TikTok", Icon: Music2 },
  { href: "/dashboard/threads", label: "Threads", Icon: AtSign },
];

export default function Nav({ email, role }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const onDash = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const [dashOpen, setDashOpen] = useState(onDash);

  const isActive = (href) => pathname === href || pathname.startsWith(`${href}/`);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // abaikan — tetap arahkan ke login
    }
    router.push("/login");
    router.refresh();
  }

  const secondary = [
    { href: "/account", label: "Akun", Icon: UserRound },
    ...(role === "admin"
      ? [
          { href: "/settings", label: "Pengaturan", Icon: Settings },
          { href: "/activity", label: "Log Aktivitas", Icon: ScrollText },
        ]
      : []),
  ];

  const NavLink = ({ href, label, Icon }) => {
    const active = isActive(href);
    return (
      <Link
        href={href}
        className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors hover:bg-[rgba(16,24,40,.04)]"
        style={active
          ? { background: "rgba(91,99,235,.10)", color: "var(--teal-900)", fontWeight: 600 }
          : { color: "var(--ink-soft)" }}
      >
        <Icon size={16} strokeWidth={2.1} aria-hidden />
        <span>{label}</span>
      </Link>
    );
  };

  const Brand = ({ compact }) => (
    <div className="flex items-center gap-2.5">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-xl text-sm font-extrabold text-white"
        style={{ background: "linear-gradient(160deg,#a5b4fc,#6b73f0 55%,#3730a3)", boxShadow: "0 0 16px -2px rgba(127,224,208,.5)" }}
      >
        E
      </div>
      {!compact && (
        <div className="leading-none">
          <div className="text-[13px] font-bold tracking-tight" style={{ color: "var(--on-bg)" }}>Elio Analyst</div>
          <div className="mt-0.5 text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--on-bg-soft)" }}>Sosmed</div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* ───── SIDEBAR (desktop) — panel kaca MELAYANG (margin di semua sisi) ───── */}
      <aside
        className="fixed left-3 top-6 z-40 hidden w-60 flex-col rounded-2xl px-2.5 py-3 md:flex"
        style={{
          height: "calc(100vh - 3rem)",
          background: "#ffffff",
          border: "1px solid var(--line)",
          boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 12px 32px -16px rgba(16,24,40,.18)",
        }}
      >
        <div className="px-1.5 pb-2.5"><Brand /></div>
        <div className="px-0.5 pb-2.5"><GlobalSearch /></div>

        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
          <p className="px-2.5 pb-1 pt-0.5 text-[9px] font-semibold uppercase tracking-widest" style={{ color: "var(--ink-soft)" }}>Menu</p>

          {/* Dashboard — grup expandable per platform */}
          <div>
            <button
              type="button"
              onClick={() => setDashOpen((o) => !o)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors hover:bg-[rgba(16,24,40,.04)]"
              style={onDash ? { background: "rgba(91,99,235,.10)", color: "var(--teal-900)", fontWeight: 600 } : { color: "var(--ink-soft)" }}
              aria-expanded={dashOpen || onDash}
            >
              <LayoutDashboard size={16} strokeWidth={2.1} aria-hidden />
              <span>Dashboard</span>
              <ChevronDown size={14} className="ml-auto transition-transform" style={{ transform: (dashOpen || onDash) ? "rotate(0deg)" : "rotate(-90deg)" }} aria-hidden />
            </button>
            {(dashOpen || onDash) && (
              <div className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l pl-2.5" style={{ borderColor: "var(--line)" }}>
                {DASH_SUB.map((s) => {
                  const act = s.exact ? pathname === s.href : (pathname === s.href || pathname.startsWith(`${s.href}/`));
                  return (
                    <Link
                      key={s.href}
                      href={s.href}
                      className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors hover:bg-[rgba(16,24,40,.04)]"
                      style={act ? { background: "rgba(91,99,235,.12)", color: "var(--teal-900)", fontWeight: 700 } : { color: "var(--ink-soft)" }}
                    >
                      <s.Icon size={14} strokeWidth={2.1} aria-hidden />
                      <span>{s.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {PRIMARY.slice(1).map((l) => <NavLink key={l.href} {...l} />)}
          <div className="my-1.5 h-px" style={{ background: "var(--line)" }} />
          {secondary.map((l) => <NavLink key={l.href} {...l} />)}
        </nav>

        <div className="mt-auto border-t pt-2.5" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center gap-2 px-1.5 pb-1.5">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: "linear-gradient(180deg,#a5b4fc,#3f46c9)" }}>
              {(email || "?").charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[11px] font-semibold" style={{ color: "var(--ink)" }}>{email}</div>
              {role && <div className="text-[9px] capitalize" style={{ color: "var(--ink-soft)" }}>{role}</div>}
            </div>
          </div>
          <button type="button" onClick={handleLogout} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors hover:bg-red-50" style={{ color: "#dc2626" }}>
            <LogOut size={15} aria-hidden /> Keluar
          </button>
        </div>
      </aside>

      {/* ───── SIDEBAR KANAN (informasi) ───── */}
      <InfoRail />

      {/* ───── TOPBAR (mobile) ───── */}
      <header
        className="fixed inset-x-0 top-0 z-40 flex items-center gap-2 px-3 py-2 md:hidden"
        style={{
          background: "#ffffff",
          borderBottom: "1px solid var(--line)",
          boxShadow: "0 1px 3px rgba(16,24,40,.06)",
        }}
      >
        <Brand compact />
        <div className="ml-1 min-w-0 flex-1"><GlobalSearch /></div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1 rounded-full py-1 pl-1 pr-1.5"
            style={{ background: "#f4f6fb", border: "1px solid var(--line)" }}
            aria-label="Menu akun"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "linear-gradient(180deg,#a5b4fc,#3f46c9)" }}>
              {(email || "?").charAt(0).toUpperCase()}
            </span>
            <ChevronDown size={15} style={{ color: "var(--ink-soft)" }} aria-hidden />
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div
                className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl"
                style={{
                  background: "#ffffff",
                  boxShadow: "0 18px 40px -12px rgba(16,24,40,.25)",
                  border: "1px solid var(--line)",
                }}
              >
                <div className="border-b px-3 py-2" style={{ borderColor: "var(--line)" }}>
                  <div className="truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>{email}</div>
                  {role && <div className="text-xs capitalize" style={{ color: "var(--ink-soft)" }}>{role}</div>}
                </div>
                {secondary.map((m) => (
                  <Link key={m.href} href={m.href} onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[rgba(16,24,40,.04)]" style={{ color: "var(--ink)" }}>
                    <m.Icon size={16} aria-hidden /> {m.label}
                  </Link>
                ))}
                <button type="button" onClick={handleLogout} className="flex w-full items-center gap-2 border-t px-3 py-2 text-sm hover:bg-red-50" style={{ borderColor: "var(--line)", color: "#dc2626" }}>
                  <LogOut size={16} aria-hidden /> Keluar
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* ───── BOTTOM-NAV (mobile) ───── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 md:hidden"
        style={{
          background: "#ffffff",
          borderTop: "1px solid var(--line)",
          boxShadow: "0 -4px 16px -8px rgba(16,24,40,.12)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        aria-label="Navigasi bawah"
      >
        {PRIMARY.map((l) => {
          const active = isActive(l.href);
          return (
            <Link key={l.href} href={l.href} className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold" style={active ? { color: "var(--teal-900)" } : { color: "var(--ink-soft)" }}>
              <span className="flex h-7 w-12 items-center justify-center rounded-full" style={active ? { background: "rgba(91,99,235,.10)" } : undefined}>
                <l.Icon size={19} strokeWidth={2.2} aria-hidden />
              </span>
              {l.label}
            </Link>
          );
        })}
      </nav>

      <IdleLogout />
    </>
  );
}
