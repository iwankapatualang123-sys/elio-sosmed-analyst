// File: components/LogoutButton.jsx
// Tombol keluar (client) — signOut lalu arahkan ke /login.

"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Button from "@/components/Button";

export default function LogoutButton() {
  const router = useRouter();
  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
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
