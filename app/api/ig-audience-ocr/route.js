// File: app/api/ig-audience-ocr/route.js
// Baca screenshot/PDF "Pemirsa" Instagram via model VISION Groq → JSON demografi.
// Hasil DIPAKAI SEBAGAI DRAF: dikembalikan ke form untuk dicek & dikoreksi user
// sebelum disimpan (tidak langsung masuk DB). Auth via sesi (admin/manager).
// Runtime Node (butuh Buffer untuk ekstrak gambar dari PDF).

import { NextResponse } from "next/server";
import { getCurrentProfile, canWrite } from "@/lib/auth";
import { isGroqConfigured, groqChatVision } from "@/lib/ai/groq-client";
import { extractPemirsaImage } from "@/lib/instagram/pemirsa-extract";
import { looksLikePemirsaCsv, parsePemirsaCsv } from "@/lib/instagram/pemirsa-csv";

export const runtime = "nodejs";

const AGE_BRACKETS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

const PROMPT = `Kamu membaca SATU screenshot halaman "Pemirsa" (Audience) Instagram dari Meta Business Suite, berbahasa Indonesia. Ekstrak angkanya menjadi JSON.

Aturan angka Indonesia: titik = pemisah ribuan, koma = desimal. Contoh: "11.678" -> 11678 ; "59,7%" -> 59.7.

Keluarkan HANYA JSON valid (tanpa penjelasan, tanpa markdown) dengan skema PERSIS:
{
  "followers": <integer dari angka besar di bawah "Pengikut", atau null>,
  "female_pct": <persen "Perempuan" pada legenda, number, atau null>,
  "male_pct": <persen "Laki-laki" pada legenda, number, atau null>,
  "age": [ { "bracket": "18-24", "female": <number|null>, "male": <number|null> }, ... untuk 25-34,35-44,45-54,55-64,65+ ],
  "cities": [ "<Kota, Provinsi>", ... urut dari daftar "Kota populer" ],
  "countries": [ { "name": "<negara>", "pct": <number|null> }, ... dari "Negara Populer" ]
}
Untuk "age": baca grafik batang "Usia & jenis kelamin" (biru muda = Perempuan, biru tua = Laki-laki), perkirakan persen tiap batang dari sumbu (0%,10%,20%,30%). Kalau ragu, isi null. Jangan mengarang kota/negara yang tidak terlihat.`;

function num(v) {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/%/g, "").replace(/\./g, "").replace(/,/g, ".").trim();
  // ^ hati2: untuk followers titik=ribuan (dibuang); untuk pct biasanya tak ada titik.
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}
function pct(v) {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : null;
  const s = String(v).replace(/%/g, "").replace(/,/g, ".").trim();
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : Math.min(100, Math.max(0, n));
}

export async function POST(request) {
  const profile = await getCurrentProfile();
  if (!profile?.role) return NextResponse.json({ error: "Belum login." }, { status: 401 });
  if (!canWrite(profile)) return NextResponse.json({ error: "Role Anda tidak bisa input data." }, { status: 403 });

  // Ambil file dulu.
  let buf, file;
  try {
    const form = await request.formData();
    file = form.get("file");
    if (!file || typeof file.arrayBuffer !== "function") return NextResponse.json({ error: "File tidak ada." }, { status: 400 });
    buf = Buffer.from(await file.arrayBuffer());
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Gagal membaca file." }, { status: 400 });
  }

  // JALUR CSV — file data asli, dibaca LANGSUNG tanpa AI (paling andal).
  if (looksLikePemirsaCsv(buf, file.name)) {
    try {
      const p = parsePemirsaCsv(buf);
      return NextResponse.json({
        ok: true,
        source: "csv",
        data: {
          followers: null, // tak ada di CSV
          female_pct: p.female_pct,
          male_pct: p.male_pct,
          age: p.age,
          cities: p.cities.map((c) => c.name),
          countries: p.countries,
        },
      });
    } catch (err) {
      return NextResponse.json({ error: err?.message || "CSV Pemirsa tidak bisa dibaca." }, { status: 200 });
    }
  }

  // JALUR GAMBAR/PDF — perlu AI vision.
  if (!isGroqConfigured()) return NextResponse.json({ error: "Baca-otomatis dari gambar/PDF belum aktif (GROQ_API_KEY belum diset). Tip: ekspor Pemirsa sebagai CSV (bisa dibaca tanpa AI), atau ketik manual.", configured: false }, { status: 200 });

  let dataUrl;
  try {
    ({ dataUrl } = extractPemirsaImage(buf, file.type, file.name));
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Gagal membaca file." }, { status: 400 });
  }

  let raw;
  try {
    raw = await groqChatVision(dataUrl, PROMPT, { jsonMode: true, maxTokens: 900 });
  } catch (err) {
    // Model vision mungkin tak aktif untuk key ini — mundur ke manual dengan pesan jelas.
    return NextResponse.json({ error: `Gagal baca gambar via AI: ${err?.message || err}. Ketik manual saja.` }, { status: 200 });
  }

  let parsed;
  try {
    const jsonStr = raw.replace(/```json|```/gi, "").trim();
    const start = jsonStr.indexOf("{");
    const end = jsonStr.lastIndexOf("}");
    parsed = JSON.parse(start >= 0 && end >= 0 ? jsonStr.slice(start, end + 1) : jsonStr);
  } catch {
    return NextResponse.json({ error: "AI membaca gambar tapi hasilnya tidak bisa diproses. Ketik manual saja." }, { status: 200 });
  }

  // Rapikan ke bentuk field form.
  const ageIn = Array.isArray(parsed.age) ? parsed.age : [];
  const byBracket = new Map(ageIn.map((a) => [String(a.bracket || "").trim(), a]));
  const age = AGE_BRACKETS.map((b) => {
    const r = byBracket.get(b) || {};
    return { bracket: b, female: pct(r.female), male: pct(r.male) };
  });
  const data = {
    followers: (() => { const n = num(parsed.followers); return n == null ? null : Math.round(n); })(),
    female_pct: pct(parsed.female_pct),
    male_pct: pct(parsed.male_pct),
    age,
    cities: (Array.isArray(parsed.cities) ? parsed.cities : []).map((c) => String(c || "").trim()).filter(Boolean).slice(0, 15),
    countries: (Array.isArray(parsed.countries) ? parsed.countries : []).map((c) => ({ name: String(c?.name || "").trim(), pct: pct(c?.pct) })).filter((c) => c.name).slice(0, 15),
  };

  return NextResponse.json({ ok: true, source: "vision", data });
}
