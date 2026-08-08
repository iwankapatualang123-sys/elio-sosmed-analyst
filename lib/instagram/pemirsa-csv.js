// File: lib/instagram/pemirsa-csv.js
// Parser CSV "Pemirsa" (Audience) Instagram dari Meta Business Suite. BEDA dari
// ekspor PDF/gambar: CSV ini berisi DATA teks, jadi dibaca LANGSUNG tanpa AI.
// Ciri file: UTF-16LE (BOM ff fe), baris pertama "sep=,", lalu beberapa SEKSI:
//   "Usia & jenis kelamin" : baris [rentang, %perempuan, %laki-laki]
//   "Negara Populer"        : 1 baris nama, 1 baris persen
//   "Kota populer"          : 1 baris nama, 1 baris persen
// Catatan: CSV ini TIDAK memuat total follower & ringkasan gender — gender dihitung
// dari penjumlahan kolom usia (persis angka legenda Meta). Total follower tetap
// diketik manual.

const AGE_BRACKETS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

// Decode buffer sesuai BOM (UTF-16LE/BE) atau fallback UTF-8.
function decode(buffer) {
  const b = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (b[0] === 0xff && b[1] === 0xfe) return b.toString("utf16le").replace(/^﻿/, "");
  if (b[0] === 0xfe && b[1] === 0xff) {
    const swapped = Buffer.from(b); swapped.swap16();
    return swapped.toString("utf16le").replace(/^﻿/, "");
  }
  return b.toString("utf8").replace(/^﻿/, "");
}

// Pisah satu baris CSV menjadi field, menghormati tanda kutip (kota mengandung koma).
function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i += 1; } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const numOrNull = (v) => {
  const s = String(v ?? "").replace(/%/g, "").replace(/,/g, ".").trim();
  if (s === "") return null;
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
};
const round1 = (n) => Math.round(n * 10) / 10;

// Deteksi cepat: apakah buffer ini file CSV Pemirsa? (untuk memilih jalur parse)
export function looksLikePemirsaCsv(buffer, name = "") {
  if (/\.csv$/i.test(name)) return true;
  const head = decode(buffer).slice(0, 400).toLowerCase();
  return head.includes("usia & jenis kelamin") || head.includes("kota populer") || head.includes("negara populer");
}

// Parse -> { age:[{bracket,female,male}], countries:[{name,pct}], cities:[{name,pct}],
//           female_pct, male_pct }. Melempar Error kalau strukturnya tak dikenal.
export function parsePemirsaCsv(buffer) {
  const text = decode(buffer);
  const rows = text.split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^sep\s*=/i.test(l))
    .map(splitCsvLine);

  const findIdx = (re) => rows.findIndex((r) => re.test((r[0] || "")));

  // --- Usia & jenis kelamin ---
  const age = [];
  const ageIdx = findIdx(/usia\s*&?\s*jenis\s*kelamin/i);
  if (ageIdx >= 0) {
    for (let i = ageIdx + 1; i < rows.length; i += 1) {
      const r = rows[i];
      const label = (r[0] || "").trim();
      if (/perempuan|laki/i.test(label) || label === "") continue; // baris header
      if (!/^\d{2}\s*[-+]/.test(label) && !AGE_BRACKETS.includes(label)) break; // keluar seksi
      age.push({ bracket: label, female: numOrNull(r[1]), male: numOrNull(r[2]) });
      if (age.length >= AGE_BRACKETS.length) break;
    }
  }

  // --- Negara Populer (1 baris nama, 1 baris persen) ---
  const countries = [];
  const negIdx = findIdx(/negara\s*populer/i);
  if (negIdx >= 0 && rows[negIdx + 1]) {
    const names = rows[negIdx + 1];
    const pcts = rows[negIdx + 2] || [];
    names.forEach((nm, i) => { if (nm) countries.push({ name: nm, pct: numOrNull(pcts[i]) }); });
  }

  // --- Kota populer (1 baris nama, 1 baris persen) ---
  const cities = [];
  const kotaIdx = findIdx(/kota\s*populer/i);
  if (kotaIdx >= 0 && rows[kotaIdx + 1]) {
    const names = rows[kotaIdx + 1];
    const pcts = rows[kotaIdx + 2] || [];
    names.forEach((nm, i) => { if (nm) cities.push({ name: nm, pct: numOrNull(pcts[i]) }); });
  }

  if (!age.length && !countries.length && !cities.length) {
    throw new Error("Bukan CSV Pemirsa yang dikenal (tak menemukan seksi Usia/Negara/Kota).");
  }

  // Gender ringkas = jumlah kolom usia (persis angka legenda Meta).
  const sum = (k) => age.reduce((s, a) => s + (Number(a[k]) || 0), 0);
  const female_pct = age.length ? round1(sum("female")) : null;
  const male_pct = age.length ? round1(sum("male")) : null;

  // Lengkapi age ke 6 rentang standar (biar form konsisten).
  const byBracket = new Map(age.map((a) => [a.bracket, a]));
  const ageFull = AGE_BRACKETS.map((b) => byBracket.get(b) || { bracket: b, female: null, male: null });

  return {
    age: ageFull,
    countries: countries.slice(0, 15),
    cities: cities.slice(0, 15),
    female_pct,
    male_pct,
    followers: null, // tidak ada di CSV — diisi manual
  };
}
