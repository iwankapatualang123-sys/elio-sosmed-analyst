// File: app/page.js
// Halaman root: arahkan ke /upload (middleware yang mengurus auth — kalau belum
// login otomatis dilempar ke /login).

import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
