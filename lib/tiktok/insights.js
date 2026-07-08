// File: lib/tiktok/insights.js
// Tujuan: menghasilkan insight (Kesimpulan + Saran) per aspek dari metrik TikTok,
// berbasis FORMULA/aturan (bukan AI). Ini fondasi yang selalu jalan; nanti bisa
// diperkaya jadi kalimat natural via Groq (lib/tiktok/insight-prompt + Edge Function),
// mengikuti blueprint bagian 5 & 18.
//
// 4 aspek (blueprint bagian 5): Konten & Performa Views, Engagement Rate,
// Follower & Audiens, Retensi Viewers. Murni (tanpa jaringan) — mudah dites.

// Fungsi: fmt — format angka ke ribuan gaya Indonesia.
function fmt(n) {
  return Number(n || 0).toLocaleString("id-ID");
}

// Fungsi: generateInsights
// Input: { summary (summarizeContent), growth (followerGrowth), viewers
//   (viewersRatio), bestHours (bestPostingTimes), hashtags (hashtagStats, opsional) }.
// Output: array { aspek, kesimpulan, saran, status }.
export function generateInsights({ summary, growth, viewers, bestHours, hashtags = [] } = {}) {
  const out = [];
  const s = summary || {};
  const g = growth || {};
  const v = viewers || {};

  // 1) Konten & Performa Views
  {
    const topHashtag = hashtags[0];
    const kesimpulan = `Ada ${fmt(s.totalVideos)} video dengan total ${fmt(s.totalViews)} views `
      + `(rata-rata ${fmt(s.avgViewsPerPost)} views/video).`;
    const saran = topHashtag
      ? `Hashtag "${topHashtag.hashtag}" paling sering dipakai (${topHashtag.count}x, rata-rata ${fmt(topHashtag.avgViews)} views) — pertimbangkan pertahankan tema ini.`
      : "Tambahkan hashtag relevan di judul agar mudah dianalisis performanya.";
    out.push({ aspek: "Konten & Performa Views", kesimpulan, saran, status: "info" });
  }

  // 2) Engagement Rate — ambang sederhana: <2% rendah, 2–6% wajar, >6% bagus.
  {
    const er = s.engagementRateOverall || 0;
    let status = "stabil";
    let nilai = "wajar";
    if (er < 2) { status = "turun"; nilai = "tergolong rendah"; }
    else if (er > 6) { status = "naik"; nilai = "tergolong tinggi"; }
    const kesimpulan = `Engagement rate keseluruhan ${er}% (${nilai}).`;
    const saran = er < 2
      ? "Perkuat call-to-action (ajak like/komentar/share) dan hook di 3 detik pertama."
      : er > 6
        ? "Pola konten sudah resonan — replikasi format video dengan ER tertinggi."
        : "Konsisten; uji variasi hook/CTA untuk mendorong ER lebih tinggi.";
    out.push({ aspek: "Engagement Rate", kesimpulan, saran, status });
  }

  // 3) Follower & Audiens
  {
    const net = g.netGrowth || 0;
    const status = net > 0 ? "naik" : net < 0 ? "turun" : "stabil";
    const kesimpulan = `Follower ${net >= 0 ? "bertambah" : "berkurang"} ${fmt(Math.abs(net))} `
      + `(${fmt(g.startFollowers)} → ${fmt(g.endFollowers)}) selama ${fmt(g.days)} hari.`;
    const saran = net > 0
      ? "Momentum positif — jaga frekuensi posting terutama di jam ramai."
      : net < 0
        ? "Follower turun — evaluasi konten terbaru & konsistensi jadwal posting."
        : "Follower stagnan — coba format/kolaborasi baru untuk memicu pertumbuhan.";
    out.push({ aspek: "Follower & Audiens", kesimpulan, saran, status });
  }

  // 4) Retensi Viewers (new vs returning)
  {
    const ret = v.returningPct || 0;
    let status = "stabil";
    if (ret >= 35) status = "naik";
    else if (ret > 0 && ret < 15) status = "turun";
    const kesimpulan = v.daysCounted
      ? `Penonton kembali ${ret}% vs baru ${v.newPct || 0}% (dari ${fmt(v.daysCounted)} hari lengkap).`
      : "Data viewers belum tersedia/lengkap untuk periode ini.";
    const saran = ret >= 35
      ? "Loyalitas penonton bagus — pertimbangkan konten berseri untuk menjaga returning."
      : ret > 0
        ? "Dominan penonton baru — buat konten pengikat (series/CTA follow) agar kembali lagi."
        : "Pastikan data Viewers ter-upload agar retensi bisa dievaluasi.";
    const bestHourNote = bestHours?.topHours?.[0]
      ? ` Jam paling ramai: ${String(bestHours.topHours[0].hour).padStart(2, "0")}:00.`
      : "";
    out.push({ aspek: "Retensi Viewers", kesimpulan: kesimpulan + bestHourNote, saran, status });
  }

  return out;
}

// Fungsi: buildInsightPrompt
// Susun prompt ringkas untuk Groq agar merangkai insight formula jadi kalimat
// natural (dipakai lib/tiktok groq route bila key tersedia). Blueprint bagian 18.
// Input: nama cabang + array insight. Output: string prompt.
export function buildInsightPrompt(namaCabang, insights) {
  const lines = insights.map((i) => `- ${i.aspek}: ${i.kesimpulan} Saran: ${i.saran}`).join("\n");
  return [
    `Kamu analis media sosial. Rangkai poin data berikut untuk akun TikTok "${namaCabang}" `,
    "menjadi ringkasan naratif singkat (maksimal 4 kalimat), Bahasa Indonesia, nada profesional, ",
    "tanpa mengarang angka baru:\n",
    lines,
  ].join("");
}
