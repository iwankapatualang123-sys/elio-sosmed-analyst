// File: lib/instagram/pemirsa-csv.js
// Parser CSV "Pemirsa"/"Audience" Instagram dari Meta Business Suite. BEDA dari
// ekspor PDF/gambar: CSV ini berisi DATA teks, jadi dibaca LANGSUNG tanpa AI.
//
// ROBUST UNTUK SEMUA OUTLET (bukan cuma satu): akun Meta bisa berbahasa Indonesia
// ATAU Inggris, dan pemisah kolom bisa "," atau ";". Semua dideteksi otomatis:
//   - pemisah        : dari baris "sep=X" (default ",").
//   - nama seksi     : Usia/Age, Negara/Countries, Kota/Cities (ID/EN).
//   - kolom gender   : dipetakan dari baris header (Perempuan/Women, Laki-laki/Men),
//                      TIDAK mengandalkan urutan kolom.
// Ciri file: sering UTF-16LE (BOM ff fe), baris pertama "sep=,", lalu beberapa seksi.
// Catatan: CSV ini TIDAK memuat total follower — itu tetap diketik manual. Gender
// ringkas dihitung dari penjumlahan kolom usia (persis angka legenda Meta).

const AGE_BRACKETS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

const RE_AGE = /(usia|umur|age)/i;
const RE_AGE_GENDER = /(kelamin|gender)/i;
const RE_COUNTRY = /(negara|countr(y|ies))/i;
const RE_CITY = /(kota|cit(y|ies))/i;
const RE_FEMALE = /(perempuan|wanita|women|female)/i;
const RE_MALE = /(laki|pria|\bmen\b|male)/i;
const RE_BRACKET = /^\d{1,2}\s*[-–+]/; // "18-24", "65+"

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
function splitCsvLine(line, delim) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i += 1; } else inQ = false; }
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const numOrNull = (v) => {
  let s = String(v ?? "").replace(/%/g, "").trim();
  if (s === "") return null;
  // Kalau ada koma & titik, anggap titik=ribuan, koma=desimal (format ID) -> normalkan.
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
};
const round1 = (n) => Math.round(n * 10) / 10;
const nonEmpty = (r) => r.filter((c) => c && c.trim() !== "");
const isLoneCell = (r) => nonEmpty(r).length === 1; // baris judul seksi = 1 sel terisi

// Deteksi cepat: apakah buffer ini file CSV Pemirsa? (ID/EN)
export function looksLikePemirsaCsv(buffer, name = "") {
  const head = decode(buffer).slice(0, 600).toLowerCase();
  const hit = (RE_AGE.test(head) && RE_AGE_GENDER.test(head)) || RE_COUNTRY.test(head) || RE_CITY.test(head);
  // .csv + minimal salah satu penanda seksi (biar tak salah tangkap CSV lain).
  return (/\.csv$/i.test(name) && hit) || hit;
}

// Parse -> { age:[{bracket,female,male}], countries:[{name,pct}], cities:[{name,pct}],
//           female_pct, male_pct, followers:null }. Melempar Error kalau tak dikenal.
export function parsePemirsaCsv(buffer) {
  const text = decode(buffer);
  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "");

  // Pemisah kolom: dari "sep=X" bila ada, jika tidak tebak dari ; vs ,.
  let delim = ",";
  const sepLine = rawLines.find((l) => /^sep\s*=/i.test(l));
  if (sepLine) { const d = sepLine.split("=")[1]?.trim(); if (d) delim = d[0]; }
  else if ((text.match(/;/g) || []).length > (text.match(/,/g) || []).length) delim = ";";

  const rows = rawLines.filter((l) => !/^sep\s*=/i.test(l)).map((l) => splitCsvLine(l, delim));

  // Cari baris JUDUL seksi (1 sel terisi) yang cocok predikat.
  const findSection = (pred) => rows.findIndex((r) => isLoneCell(r) && pred((nonEmpty(r)[0] || "")));

  // --- Usia & jenis kelamin / Age & gender ---
  const age = [];
  const ageIdx = findSection((s) => RE_AGE.test(s) && RE_AGE_GENDER.test(s));
  if (ageIdx >= 0) {
    // Baris header kolom (mis. ["","Perempuan","Laki-laki"]) -> petakan indeks gender.
    let femaleCol = 1;
    let maleCol = 2;
    const headerRow = rows[ageIdx + 1] || [];
    const fi = headerRow.findIndex((c) => RE_FEMALE.test(c));
    const mi = headerRow.findIndex((c) => RE_MALE.test(c));
    const hasHeader = fi >= 0 || mi >= 0;
    if (fi >= 0) femaleCol = fi;
    if (mi >= 0) maleCol = mi;
    for (let i = ageIdx + (hasHeader ? 2 : 1); i < rows.length; i += 1) {
      const r = rows[i];
      const label = (r[0] || "").trim();
      if (!RE_BRACKET.test(label) && !AGE_BRACKETS.includes(label)) break; // keluar seksi
      age.push({ bracket: label.replace(/–/g, "-").replace(/\s+/g, ""), female: numOrNull(r[femaleCol]), male: numOrNull(r[maleCol]) });
      if (age.length >= AGE_BRACKETS.length) break;
    }
  }

  // Helper seksi "nama di 1 baris, persen di baris berikutnya".
  const readNamePctSection = (idx) => {
    const out = [];
    if (idx < 0) return out;
    const names = rows[idx + 1] || [];
    const pcts = rows[idx + 2] || [];
    names.forEach((nm, i) => { if (nm && nm.trim()) out.push({ name: nm.trim(), pct: numOrNull(pcts[i]) }); });
    return out;
  };

  const countries = readNamePctSection(findSection((s) => RE_COUNTRY.test(s))).slice(0, 20);
  const cities = readNamePctSection(findSection((s) => RE_CITY.test(s))).slice(0, 20);

  if (!age.length && !countries.length && !cities.length) {
    throw new Error("Bukan CSV Pemirsa yang dikenal (tak menemukan seksi Usia/Negara/Kota, baik versi Indonesia maupun Inggris).");
  }

  const sum = (k) => age.reduce((s, a) => s + (Number(a[k]) || 0), 0);
  const female_pct = age.length ? round1(sum("female")) : null;
  const male_pct = age.length ? round1(sum("male")) : null;

  const byBracket = new Map(age.map((a) => [a.bracket, a]));
  const ageFull = AGE_BRACKETS.map((b) => byBracket.get(b) || { bracket: b, female: null, male: null });

  return { age: ageFull, countries, cities, female_pct, male_pct, followers: null };
}
