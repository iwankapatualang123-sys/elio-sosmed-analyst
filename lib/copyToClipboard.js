// File: lib/copyToClipboard.js
// Tujuan: salin teks ke clipboard dengan fallback. navigator.clipboard hanya ada
// di "secure context" (HTTPS atau literal "localhost") — kalau app diakses lewat
// IP jaringan tanpa HTTPS (mis. 192.168.x.x, lihat blueprint bagian 24), API ini
// undefined dan tombol "Salin" akan gagal diam-diam tanpa fallback ini.

// Fungsi: copyToClipboard — coba Clipboard API modern, fallback ke execCommand
// lama kalau tidak tersedia/gagal. Input: string. Output (async): boolean berhasil.
export async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // lanjut ke fallback di bawah
    }
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
