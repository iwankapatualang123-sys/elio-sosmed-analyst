// File: components/ServiceWorkerRegister.jsx
// Daftarkan service worker PWA (hanya di produksi — SW + HMR dev bisa bikin konten
// basi). Tidak merender apa pun.

"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
