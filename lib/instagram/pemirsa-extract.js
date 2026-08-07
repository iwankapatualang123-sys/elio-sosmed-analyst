// File: lib/instagram/pemirsa-extract.js
// Ambil GAMBAR dari file "Pemirsa" yang di-upload untuk dibaca model vision.
// - Kalau file sudah berupa gambar (png/jpg/webp) -> pakai langsung.
// - Kalau PDF (mis. hasil jsPDF Meta) -> ekstrak JPEG terbesar yang tertanam di
//   dalamnya (tanpa perlu poppler): cari blok stream…endstream lalu potongan
//   penanda JPEG (FFD8…FFD9). Gambar terbesar = isi halaman Pemirsa.
// Output: { dataUrl } (data:image/...;base64,...) atau melempar Error.

const MAX_BYTES = 8 * 1024 * 1024; // batas wajar untuk dikirim ke API vision

function toDataUrl(mime, buf) {
  return `data:${mime};base64,${buf.toString("base64")}`;
}

// Cari semua JPEG tertanam dalam byte PDF, kembalikan yang terbesar.
function largestJpegFromPdf(buf) {
  let pos = 0;
  let best = null;
  const S = Buffer.from("stream");
  const E = Buffer.from("endstream");
  const SOI = Buffer.from([0xff, 0xd8, 0xff]);
  const EOI = Buffer.from([0xff, 0xd9]);
  while (true) {
    const a = buf.indexOf(S, pos);
    if (a < 0) break;
    let b = a + 6;
    if (buf[b] === 13) b += 1;
    if (buf[b] === 10) b += 1;
    const e = buf.indexOf(E, b);
    if (e < 0) break;
    const raw = buf.slice(b, e);
    const j = raw.indexOf(SOI);
    if (j >= 0) {
      const end = raw.lastIndexOf(EOI);
      if (end > j) {
        const img = raw.slice(j, end + 2);
        if (!best || img.length > best.length) best = img;
      }
    }
    pos = e + 9;
  }
  return best;
}

export function extractPemirsaImage(buffer, mime = "", name = "") {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const lowerName = String(name || "").toLowerCase();
  const isPdf = /pdf/i.test(mime) || lowerName.endsWith(".pdf") || buf.slice(0, 5).toString("latin1") === "%PDF-";

  if (isPdf) {
    const jpeg = largestJpegFromPdf(buf);
    if (!jpeg) throw new Error("Tidak menemukan gambar di dalam PDF. Coba screenshot layar Pemirsa lalu upload gambarnya (PNG/JPG).");
    if (jpeg.length > MAX_BYTES) throw new Error("Gambar dalam PDF terlalu besar untuk dibaca. Coba screenshot bagian Pemirsa saja.");
    return { dataUrl: toDataUrl("image/jpeg", jpeg) };
  }

  // File gambar langsung.
  const isImage = /^image\//i.test(mime) || /\.(png|jpe?g|webp)$/i.test(lowerName)
    || buf.slice(0, 3).toString("latin1") === "\xFF\xD8\xFF" // jpeg
    || buf.slice(0, 8).toString("latin1") === "\x89PNG\r\n\x1a\n"; // png
  if (!isImage) throw new Error("Format tidak didukung. Upload gambar (PNG/JPG) atau PDF halaman Pemirsa.");
  if (buf.length > MAX_BYTES) throw new Error("Gambar terlalu besar (maks ~8MB).");
  const detectedMime = /png/i.test(mime) || lowerName.endsWith(".png") ? "image/png"
    : /webp/i.test(mime) || lowerName.endsWith(".webp") ? "image/webp" : "image/jpeg";
  return { dataUrl: toDataUrl(detectedMime, buf) };
}
