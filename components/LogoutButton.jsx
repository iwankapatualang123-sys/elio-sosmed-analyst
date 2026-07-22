// File: components/LogoutButton.jsx
// Tombol keluar (client) — hapus sesi via /api/auth/logout lalu ke /login.

"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import Button from "@/components/Button";

export default function LogoutButton() {
  const router = useRouter();
  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // abaikan — tetap arahkan ke login
    }
    router.push("/login");
    router.refresh();
  }
  return (
    <Button variant="ghost" onClick={handleLogout}>
      <LogOut size={16} strokeWidth={2.2} aria-hidden />
      Keluar
    </Button>
  );
}
