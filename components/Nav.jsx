// File: components/Nav.jsx
// Navigasi aplikasi (client) — gaya tool analitik agency: SIDEBAR KIRI tetap di
// desktop (brand + pencarian + menu + profil), TOPBAR tipis + BOTTOM-NAV di HP.
// Offset konten diatur di globals.css (main.grid3 padding saat sidebar/topbar ada).

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, UploadCloud, Database, CalendarDays, ClipboardList, FileText, Settings, UserRound, ScrollText, LogOut, ChevronDown } from "lucide-react";
import GlobalSearch from "@/components/GlobalSearch";
import IdleLogout from "@/components/IdleLogout";

const PRIMARY = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/data", label: "Data", Icon: Database },
  { href: "/report", label: "Laporan", Icon: FileText },
  { href: "/content-plan", label: "Rencana", Icon: ClipboardList },
  { href: "/calendar", label: "Kalender", Icon: CalendarDays },
  { href: "/upload", label: "Upload", Icon: UploadCloud },
];

export default function Nav({ email, role }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

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
        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-[rgba(255,255,255,.07)]"
        style={active
          ? { background: "rgba(127,224,208,.18)", color: "var(--on-bg)", boxShadow: "inset 0 0 0 1px rgba(127,224,208,.32)" }
          : { color: "var(--on-bg-soft)" }}
      >
        <Icon size={18} strokeWidth={2.1} aria-hidden />
        <span>{label}</span>
      </Link>
    );
  };

  const Brand = ({ compact }) => (
    <div className="flex items-center gap-2.5">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl text-base font-extrabold text-white"
        style={{ background: "linear-gradient(160deg,#7fe0d0,#0a8291 55%,#00434b)", boxShadow: "0 0 18px -2px rgba(127,224,208,.5)" }}
      >
        E
      </div>
      {!compact && (
        <div className="leading-none">
          <div className="text-sm font-bold tracking-tight" style={{ color: "var(--on-bg)" }}>Elio Analyst</div>
          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-widest" style={{ color: "var(--on-bg-soft)" }}>Sosmed</div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* ───── SIDEBAR (desktop) ───── */}
      <aside
        className="fixed left-0 top-0 z-40 hidden h-screen w-60 flex-col px-3 py-4 md:flex"
        style={{
          background: "linear-gradient(180deg, rgba(6,32,37,.72), rgba(4,22,26,.66))",
          WebkitBackdropFilter: "blur(20px) saturate(150%)",
          backdropFilter: "blur(20px) saturate(150%)",
          borderRight: "1px solid rgba(127,224,208,.14)",
          boxShadow: "1px 0 0 rgba(255,255,255,.04) inset, 24px 0 48px -30px rgba(0,0,0,.6)",
        }}
      >
        <div className="px-2 pb-3"><Brand /></div>
        <div className="px-0.5 pb-3"><GlobalSearch /></div>

        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
          <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--on-bg-soft)" }}>Menu</p>
          {PRIMARY.map((l) => <NavLink key={l.href} {...l} />)}
          <div className="my-2 h-px" style={{ background: "rgba(255,255,255,.1)" }} />
          {secondary.map((l) => <NavLink key={l.href} {...l} />)}
        </nav>

        <div className="mt-auto border-t pt-3" style={{ borderColor: "rgba(255,255,255,.1)" }}>
          <div className="flex items-center gap-2 px-2 pb-2">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "linear-gradient(180deg,#7fe0d0,#00545e)" }}>
              {(email || "?").charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold" style={{ color: "var(--on-bg)" }}>{email}</div>
              {role && <div className="text-[10px] capitalize" style={{ color: "var(--on-bg-soft)" }}>{role}</div>}
            </div>
          </div>
          <button type="button" onClick={handleLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-[rgba(255,90,90,.14)]" style={{ color: "#ff9b9b" }}>
            <LogOut size={16} aria-hidden /> Keluar
          </button>
        </div>
      </aside>

      {/* ───── TOPBAR (mobile) ───── */}
      <header
        className="fixed inset-x-0 top-0 z-40 flex items-center gap-2 px-3 py-2 md:hidden"
        style={{
          background: "linear-gradient(180deg, rgba(6,32,37,.78), rgba(5,26,30,.7))",
          WebkitBackdropFilter: "blur(18px) saturate(150%)",
          backdropFilter: "blur(18px) saturate(150%)",
          borderBottom: "1px solid rgba(127,224,208,.16)",
        }}
      >
        <Brand compact />
        <div className="ml-1 min-w-0 flex-1"><GlobalSearch /></div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1 rounded-full py-1 pl-1 pr-1.5"
            style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)" }}
            aria-label="Menu akun"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "linear-gradient(180deg,#7fe0d0,#00545e)" }}>
              {(email || "?").charAt(0).toUpperCase()}
            </span>
            <ChevronDown size={15} style={{ color: "var(--on-bg-soft)" }} aria-hidden />
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div
                className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl"
                style={{
                  background: "linear-gradient(180deg, rgba(9,38,44,.94), rgba(5,26,30,.94))",
                  WebkitBackdropFilter: "blur(20px) saturate(150%)",
                  backdropFilter: "blur(20px) saturate(150%)",
                  boxShadow: "0 18px 40px -12px rgba(0,0,0,.6)",
                  border: "1px solid rgba(127,224,208,.2)",
                }}
              >
                <div className="border-b px-3 py-2" style={{ borderColor: "rgba(255,255,255,.1)" }}>
                  <div className="truncate text-sm font-semibold" style={{ color: "var(--on-bg)" }}>{email}</div>
                  {role && <div className="text-xs capitalize" style={{ color: "var(--on-bg-soft)" }}>{role}</div>}
                </div>
                {secondary.map((m) => (
                  <Link key={m.href} href={m.href} onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[rgba(255,255,255,.07)]" style={{ color: "var(--on-bg)" }}>
                    <m.Icon size={16} aria-hidden /> {m.label}
                  </Link>
                ))}
                <button type="button" onClick={handleLogout} className="flex w-full items-center gap-2 border-t px-3 py-2 text-sm hover:bg-[rgba(255,90,90,.14)]" style={{ borderColor: "rgba(255,255,255,.1)", color: "#ff9b9b" }}>
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
          background: "linear-gradient(0deg, rgba(6,32,37,.85), rgba(5,26,30,.72))",
          WebkitBackdropFilter: "blur(18px) saturate(150%)",
          backdropFilter: "blur(18px) saturate(150%)",
          borderTop: "1px solid rgba(127,224,208,.16)",
          boxShadow: "0 -8px 24px -14px rgba(0,0,0,.6)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        aria-label="Navigasi bawah"
      >
        {PRIMARY.map((l) => {
          const active = isActive(l.href);
          return (
            <Link key={l.href} href={l.href} className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold" style={active ? { color: "var(--on-bg)" } : { color: "var(--on-bg-soft)" }}>
              <span className="flex h-7 w-12 items-center justify-center rounded-full" style={active ? { background: "rgba(127,224,208,.22)" } : undefined}>
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
