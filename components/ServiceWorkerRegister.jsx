// File: components/ServiceWorkerRegister.jsx
// Daftarkan service worker PWA (hanya di produksi — SW + HMR dev bisa bikin konten
// basi). Tidak merender apa pun.
//
// Anti-basi: saat service worker VERSI BARU mengambil alih (setelah deploy), tab
// yang terbuka AUTO-RELOAD sekali — jadi user langsung lihat versi terbaru tanpa
// perlu hard refresh manual. Reload dilewati pada instalasi pertama (belum ada
// controller sebelumnya) supaya tidak reload sia-sia saat pertama kali buka.

"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return undefined;

    const hadController = !!navigator.serviceWorker.controller;
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing || !hadController) return; // instalasi pertama: jangan reload
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => { try { reg.update(); } catch { /* abaikan */ } })
      .catch(() => {});

    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  return null;
}
