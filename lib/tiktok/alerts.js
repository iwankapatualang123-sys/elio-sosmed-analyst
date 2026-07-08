// File: lib/tiktok/alerts.js
// Tujuan: mengevaluasi PERINGATAN/alert dari metrik sebuah cabang (blueprint bagian
// 21C): follower turun, engagement anjlok, cabang stagnan, data belum diperbarui
// (reminder upload), dan video melonjak (viral). Murni (tanpa DB/jaringan) — dihitung
// on-the-fly dari data terbaru, jadi tidak perlu tabel notifikasi/background job.

const DEFAULTS = {
  erLow: 2, // ER di bawah ini = rendah (%)
  followerDropPct: 5, // penurunan follower harian (% dari basis) yang dianggap drastis
  staleDays: 7, // data lebih lama dari ini = reminder upload
  viralMultiple: 3, // views >= rata-rata × ini = melonjak
};

// Fungsi: evaluateAlerts
// Input: { summary (summarizeContent), growth (followerGrowth), topVideo,
//   latestDataDate ('YYYY-MM-DD'), contentThisMonth, referenceDate (Date), thresholds }.
// Output: array { level: 'danger'|'warning'|'info'|'success', title, message }.
export function evaluateAlerts({
  summary = {}, growth = {}, topVideo = null,
  latestDataDate = null, contentThisMonth = 0,
  referenceDate = new Date(), thresholds = {},
} = {}) {
  const T = { ...DEFAULTS, ...thresholds };
  const alerts = [];

  // Follower turun (net negatif sepanjang periode)
  if ((growth.netGrowth ?? 0) < 0) {
    alerts.push({
      level: "danger",
      title: "Follower turun",
      message: `Follower berkurang ${Math.abs(growth.netGrowth)} pada periode ini (${growth.startFollowers} → ${growth.endFollowers}).`,
    });
  } else if (
    growth.worstDay && growth.worstDay.diff < 0 && (growth.startFollowers || 0) > 0
    && (Math.abs(growth.worstDay.diff) / growth.startFollowers) * 100 >= T.followerDropPct
  ) {
    alerts.push({
      level: "warning",
      title: "Penurunan follower harian",
      message: `Turun ${Math.abs(growth.worstDay.diff)} follower pada ${growth.worstDay.date}.`,
    });
  }

  // Engagement rendah
  const er = summary.engagementRateOverall ?? 0;
  if (er > 0 && er < T.erLow) {
    alerts.push({
      level: "warning",
      title: "Engagement rendah",
      message: `Engagement rate ${er}% di bawah ambang ${T.erLow}%. Perkuat hook & CTA.`,
    });
  }

  // Cabang stagnan (belum ada konten bulan berjalan)
  if (contentThisMonth === 0) {
    alerts.push({
      level: "info",
      title: "Belum ada konten bulan ini",
      message: "Belum ada video yang diposting pada bulan berjalan.",
    });
  }

  // Reminder upload (data basi)
  if (latestDataDate) {
    const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
    const days = Math.floor((ref.getTime() - new Date(`${latestDataDate}T00:00:00Z`).getTime()) / 86400000);
    if (days >= T.staleDays) {
      alerts.push({
        level: "warning",
        title: "Data belum diperbarui",
        message: `Data terbaru ${latestDataDate} (${days} hari lalu). Ingatkan tim untuk upload data baru.`,
      });
    }
  }

  // Video melonjak (viral)
  if (topVideo && (summary.avgViewsPerPost || 0) > 0
    && (topVideo.total_views || 0) >= summary.avgViewsPerPost * T.viralMultiple) {
    const judul = String(topVideo.video_title || "").slice(0, 50);
    alerts.push({
      level: "success",
      title: "Video melonjak",
      message: `"${judul}…" mencapai ${topVideo.total_views} views — jauh di atas rata-rata (${summary.avgViewsPerPost}).`,
    });
  }

  return alerts;
}
