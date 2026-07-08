// File: app/layout.js
// Root layout: pasang font Poppins (self-hosted via next/font, aman untuk PWA
// offline), tema global, metadata PWA (manifest/ikon), dan registrasi service worker.
// Warna & gaya lihat app/globals.css (blueprint bagian 11).

import { Poppins } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata = {
  title: "Elio Sosmed Analyst",
  description: "Analitik TikTok multi-cabang untuk Elio Agency",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Elio Analyst",
  },
};

export const viewport = {
  themeColor: "#006674",
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={`${poppins.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
