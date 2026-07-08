// File: components/Nav.jsx
// Navigasi atas (client — usePathname untuk state aktif). Header bar teal
// ber-gradien glossy + brand wordmark + pill menu aktif (blueprint bagian 11 & 23).

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, UploadCloud, Settings, UserRound } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";

const BASE_LINKS = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/upload", label: "Upload", Icon: UploadCloud },
];

export default function Nav({ email, role }) {
  const pathname = usePathname();
  const links = [
    ...BASE_LINKS,
    ...(role === "admin" ? [{ href: "/settings", label: "Pengaturan", Icon: Settings }] : []),
    { href: "/account", label: "Akun", Icon: UserRound },
  ];

  return (
    <header
      className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-5"
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
          className="flex h-10 w-10 items-center justify-center rounded-2xl text-base font-extrabold text-white"
          style={{
            background: "linear-gradient(160deg,#7fe0d0,#0a8291 55%,#00434b)",
            boxShadow: "0 0 0 2px rgba(255,255,255,.18), 0 6px 14px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.5)",
          }}
        >
          E
        </div>
        <div className="hidden leading-none sm:block">
          <div className="text-sm font-bold tracking-tight text-white">Elio Analyst</div>
          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-widest" style={{ color: "rgba(255,255,255,.55)" }}>
            TikTok Analytics
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex items-center gap-1">
        {links.map((l) => {
          const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
          return (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-semibold transition-all sm:px-3"
              style={
                active
                  ? {
                    background: "linear-gradient(180deg,#ffffff,#eef8f1)",
                    color: "var(--teal-900)",
                    boxShadow: "0 4px 12px rgba(0,0,0,.22), 0 0 0 1px rgba(255,255,255,.6), inset 0 1px 0 #fff",
                  }
                  : { color: "rgba(255,255,255,.82)" }
              }
            >
              <l.Icon size={18} strokeWidth={2.2} aria-hidden />
              <span className="hidden sm:inline">{l.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Kanan: user chip + keluar */}
      <div className="ml-auto flex items-center gap-2">
        {email && (
          <span
            className="hidden max-w-[180px] truncate rounded-full px-3 py-1.5 text-xs font-medium text-white md:inline-block"
            style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.18)" }}
            title={`${email}${role ? ` · ${role}` : ""}`}
          >
            {email}{role ? ` · ${role}` : ""}
          </span>
        )}
        <LogoutButton />
      </div>
    </header>
  );
}
