// File: components/Nav.jsx
// Navigasi atas (client — pakai usePathname untuk state aktif). Blueprint bagian 11
// menyebut sidebar desktop + bottom-nav mobile; versi awal ini top-nav sederhana
// yang responsif, ditingkatkan menyusul.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";

const BASE_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/upload", label: "Upload", icon: "⬆️" },
];

export default function Nav({ email, role }) {
  const pathname = usePathname();
  const links = [
    ...BASE_LINKS,
    ...(role === "admin" ? [{ href: "/settings", label: "Pengaturan", icon: "⚙️" }] : []),
    { href: "/account", label: "Akun", icon: "👤" },
  ];
  return (
    <header className="card-3d flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
        style={{ background: "linear-gradient(180deg,#0a8291,#00545e)" }}
      >
        E
      </div>
      <nav className="flex items-center gap-1">
        {links.map((l) => {
          const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
          return (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-xl px-3 py-2 text-sm font-medium transition-colors"
              style={
                active
                  ? { background: "linear-gradient(180deg,#0a8291,#006674)", color: "#fff" }
                  : { color: "var(--ink-soft)" }
              }
            >
              <span className="mr-1">{l.icon}</span>
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-3">
        <span className="hidden text-right text-xs sm:block" style={{ color: "var(--ink-soft)" }}>
          {email}
          {role ? ` · ${role}` : ""}
        </span>
        <LogoutButton />
      </div>
    </header>
  );
}
