// File: components/IdleLogout.jsx
// Auto-logout setelah idle (blueprint 21F) — cegah data terekspos kalau perangkat
// ditinggal. Dipasang di Nav (hanya halaman terautentikasi). Reset timer tiap ada
// aktivitas; setelah IDLE_MS tanpa aktivitas → signOut + ke /login.

"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const IDLE_MS = 30 * 60 * 1000; // 30 menit

export default function IdleLogout() {
  const router = useRouter();
  const timer = useRef(null);

  useEffect(() => {
    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } catch {
          // abaikan
        }
        router.push("/login");
        router.refresh();
      }, IDLE_MS);
    };
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [router]);

  return null;
}
