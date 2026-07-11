// File: test/instagram-parser.test.js
// Tes parser export Instagram Business Suite (lib/instagram/parser.js).
// Fixture di sini TIRUAN yang meniru struktur file asli (UTF-16 harian, CSV per
// konten multi-baris + kolaborasi) — angka bisnis asli tidak disimpan di repo.
// Jalankan: npm run test:ig-parser

const {
  decodeBuffer, parseCsv, parseUsDateTime,
  parseDailyMetricCsv, parseContentCsv, parseInstagramFile,
} = require("../lib/instagram/parser.js");

let pass = 0;
let fail = 0;
function ok(name, cond) { if (cond) { pass += 1; console.log(`  ok  ${name}`); } else { fail += 1; console.log(`FAIL  ${name}`); } }

// Buat buffer UTF-16LE ber-BOM persis seperti file harian Business Suite.
function utf16(text) {
  const buf = Buffer.alloc(2 + text.length * 2);
  buf[0] = 0xff; buf[1] = 0xfe;
  buf.write(text, 2, "utf16le");
  return buf;
}

// ————— decode & csv dasar —————
ok("decode UTF-16LE ber-BOM", decodeBuffer(utf16("halo")) === "halo");
ok("decode UTF-8 ber-BOM", decodeBuffer(Buffer.from("﻿halo", "utf8")) === "halo");
ok("csv kutip: koma & escape", JSON.stringify(parseCsv('"a,b","c""d"')[0]) === '["a,b","c\\"d"]');
ok("csv newline dalam kutip", parseCsv('"x\ny",2')[0][0] === "x\ny");
ok("tanggal AS + jam", parseUsDateTime("06/17/2026 09:11") === "2026-06-17T09:11:00");
ok("tanggal AS tanpa jam", parseUsDateTime("7/4/2026") === "2026-07-04T00:00:00");
ok("tanggal rusak -> null", parseUsDateTime("Sepanjang Masa") === null);

// ————— file metrik harian —————
const DAILY = 'sep=,\n"Tayangan"\n"Tanggal","Primary"\n"2026-06-13T00:00:00","192"\n"2026-06-14T00:00:00","8"\n"2026-06-15T00:00:00","1641"\n';
const d1 = parseDailyMetricCsv(DAILY);
ok("harian: metrik Tayangan -> views", d1.metric === "views");
ok("harian: 3 baris terbaca", d1.rows.length === 3 && d1.rows[2].value === 1641);
ok("harian: tanggal dinormalkan", d1.rows[0].date === "2026-06-13");
ok("harian: Pengikut -> new_followers", parseDailyMetricCsv('sep=,\n"Pengikut Instagram"\n"Tanggal","Primary"\n"2026-06-14T00:00:00","6"\n').metric === "new_followers");
ok("harian: Kunjungan -> profile_visits", parseDailyMetricCsv('sep=,\n"Kunjungan Profil Instagram"\n"Tanggal","Primary"\n"2026-06-14T00:00:00","3"\n').metric === "profile_visits");
let threw = null;
try { parseDailyMetricCsv('sep=,\n"Metrik Aneh"\n"Tanggal","Primary"\n"2026-06-14T00:00:00","3"\n'); } catch (e) { threw = e; }
ok("harian: metrik asing -> error jelas", threw && /belum dikenali/.test(threw.message));

// ————— file per konten (susunan kolom outlet: ada Komentar & Disimpan) —————
const CONTENT_OUTLET = [
  '"ID Postingan","ID Akun","Nama pengguna akun","Nama akun",Deskripsi,"Durasi (detik)","Waktu penerbitan",Permalink,"Jenis postingan","Komentar data",Tanggal,Tayangan,Suka,"Frekuensi dibagikan",Komentar,"Frekuensi Disimpan",Jangkauan,Mengikuti',
  '111,900,elio,"Elio","baris satu\nbaris dua, ada koma",60,"06/17/2026 00:45",https://www.instagram.com/reel/AAA/,"Reel IG",,"Sepanjang Masa",11351,367,15,12,3,6740,2',
  '222,900,elio,"Elio","promo",0,"07/09/2026 04:52",https://www.instagram.com/p/BBB/,"Gambar IG",,"Sepanjang Masa",2438,13,3,0,0,1173,0',
  '333,901,tamu,"Akun Tamu","kolab",0,"07/08/2026 02:47",https://www.instagram.com/p/CCC/,"Carousel IG",,"Sepanjang Masa",4051,86,0,2,0,,',
].join("\n");
const c1 = parseContentCsv(CONTENT_OUTLET);
ok("konten: 3 baris terbaca", c1.rows.length === 3);
ok("konten: deskripsi multi-baris utuh", c1.rows[0].description === "baris satu\nbaris dua, ada koma");
ok("konten: angka per nama kolom", c1.rows[0].views === 11351 && c1.rows[0].comments === 12 && c1.rows[0].saves === 3 && c1.rows[0].follows === 2);
ok("konten: waktu terbit ISO", c1.rows[0].published_at === "2026-06-17T00:45:00");
ok("konten: akun sendiri = modus ID Akun", c1.ownIgAccountId === "900");
ok("konten: kolaborasi ditandai", c1.rows[2].is_collab === true && c1.rows[0].is_collab === false);
ok("konten: kolom kosong kolaborasi -> null", c1.rows[2].reach === null && c1.rows[2].follows === null);

// Susunan kolom AKUN LAIN (contoh akun pribadi: ada Balasan/Navigasi/Ketukan
// stiker, TANPA Komentar/Disimpan, urutan beda) — wajib tetap terbaca.
const CONTENT_PERSONAL = [
  '"ID Postingan","ID Akun","Nama pengguna akun","Nama akun",Deskripsi,"Durasi (detik)","Waktu penerbitan",Permalink,"Jenis postingan","Komentar data",Tanggal,Tayangan,Jangkauan,Suka,"Frekuensi dibagikan","Kunjungan profil",Balasan,Navigasi,"Ketukan stiker"',
  '555,700,orang,"Orang",,15,"06/29/2026 03:54",https://www.instagram.com/stories/orang/999/,"Cerita IG",,"Sepanjang Masa",109,84,1,0,1,0,74,4',
].join("\n");
const c2 = parseContentCsv(CONTENT_PERSONAL);
ok("konten varian: kolom story terbaca", c2.rows[0].navigation === 74 && c2.rows[0].sticker_taps === 4 && c2.rows[0].replies === 0);
ok("konten varian: kolom absen -> null", c2.rows[0].comments === null && c2.rows[0].saves === null && c2.rows[0].follows === null);
ok("konten varian: reach ikut posisi headernya", c2.rows[0].reach === 84 && c2.rows[0].profile_visits === 1);

// ————— deteksi otomatis —————
ok("deteksi: buffer UTF-16 harian", parseInstagramFile(utf16(DAILY)).kind === "daily");
ok("deteksi: buffer UTF-8 per konten", parseInstagramFile(Buffer.from(CONTENT_OUTLET, "utf8")).kind === "content");
let threw2 = null;
try { parseInstagramFile(Buffer.from("halo dunia", "utf8")); } catch (e) { threw2 = e; }
ok("deteksi: file asing -> error gabungan", threw2 && /tidak dikenali/i.test(threw2.message));

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
