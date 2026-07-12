// File: lib/tiktok/diagnosis.js
// Analisis Pertumbuhan: kalau kenaikan follower bulan ini < bulan lalu, JANGAN
// langsung menyimpulkan "konten memburuk" — follower itu akibat, konten itu sebab.
// Diagnosis memeriksa sebabnya berurutan:
//   1. Kualitas   : ER ikut turun signifikan -> memang indikasi resonansi konten turun.
//   2. Produksi   : jumlah konten turun signifikan -> masalah output, bukan kualitas.
//   3. Normalisasi: bulan lalu terangkat 1 konten viral (outlier) -> penurunan wajar.
//   4. Distribusi : semuanya stabil -> kemungkinan algoritma/musiman, pantau dulu.
// Ambang disengaja konservatif supaya kartu tidak "menuduh" tim tanpa bukti kuat.

const num = (v) => Number(v) || 0;
const round1 = (v) => Math.round(v * 10) / 10;

// Ambang keputusan (relatif, %):
const ER_DROP_PCT = -15;     // ER turun >= 15% relatif -> sinyal kualitas
const PROD_DROP_PCT = -20;   // jumlah konten turun >= 20% -> sinyal produksi
const OUTLIER_RATIO = 3;     // top video >= 3x rata-rata video lain -> viral outlier
const OUTLIER_MIN_VIEWS = 1000; // di bawah ini "viral" tidak bermakna

// Fungsi: diagnoseGrowthDrop
// Input: { current: {netGrowth, totalVideos, engagementRate},
//          previous: {netGrowth, totalVideos, engagementRate, videoViews: [int]} }.
// Output: null bila pertumbuhan TIDAK melambat; selain itu
//   { verdict:'kualitas'|'produksi'|'normalisasi'|'distribusi', level:'warning'|'info',
//     summary, growth:{prev,cur}, findings:[{key,label,detail,status}] }.
export function diagnoseGrowthDrop({ current = {}, previous = {} } = {}) {
  const curG = num(current.netGrowth);
  const prevG = num(previous.netGrowth);
  if (!(curG < prevG)) return null; // hanya relevan saat pertumbuhan melambat

  const findings = [];

  // 1) Produksi — jumlah konten.
  const cv = num(current.totalVideos);
  const pv = num(previous.totalVideos);
  const prodPct = pv > 0 ? round1(((cv - pv) / pv) * 100) : null;
  const prodDown = prodPct != null && prodPct <= PROD_DROP_PCT;
  findings.push({
    key: "produksi",
    label: "Jumlah konten",
    detail: `${pv} → ${cv} konten${prodPct != null ? ` (${prodPct > 0 ? "+" : ""}${prodPct}%)` : ""}`,
    status: prodDown ? "turun" : "stabil",
  });

  // 2) Kualitas — engagement rate (relatif, bukan poin).
  const ce = num(current.engagementRate);
  const pe = num(previous.engagementRate);
  const erPct = pe > 0 ? round1(((ce - pe) / pe) * 100) : null;
  const erDown = erPct != null && erPct <= ER_DROP_PCT;
  findings.push({
    key: "kualitas",
    label: "Engagement rate",
    detail: `${pe}% → ${ce}%${erPct != null ? ` (${erPct > 0 ? "+" : ""}${erPct}%)` : ""}`,
    status: erDown ? "turun" : "stabil",
  });

  // 3) Outlier — apakah bulan lalu terangkat 1 konten viral?
  const views = (previous.videoViews || []).map(num).filter((v) => v > 0);
  let outlier = false;
  let outlierDetail = "tidak ada konten viral menonjol bulan lalu";
  if (views.length >= 2) {
    const top = Math.max(...views);
    const rest = views.filter((v, i) => i !== views.indexOf(top));
    const avgRest = rest.reduce((s, v) => s + v, 0) / rest.length;
    if (avgRest > 0 && top >= OUTLIER_RATIO * avgRest && top >= OUTLIER_MIN_VIEWS) {
      outlier = true;
      outlierDetail = `bulan lalu ada 1 konten viral (~${round1(top / avgRest)}× rata-rata konten lain) yang mengangkat angkanya`;
    }
  }
  findings.push({ key: "outlier", label: "Konten viral bulan lalu", detail: outlierDetail, status: outlier ? "ada" : "tidak" });

  // Vonis — urutan prioritas: kualitas > produksi > normalisasi > distribusi.
  let verdict;
  let level;
  let summary;
  if (erDown) {
    verdict = "kualitas";
    level = "warning";
    summary = "Perlu perhatian: engagement rate ikut turun — indikasi resonansi konten menurun, bukan sekadar follower melambat. Tinjau jenis konten yang berkurang atau berubah dibanding bulan lalu.";
  } else if (prodDown) {
    verdict = "produksi";
    level = "warning";
    summary = "Penurunan sejalan dengan berkurangnya JUMLAH konten — ini masalah output produksi, bukan kualitas (ER stabil). Kembalikan ritme posting dulu sebelum menilai kontennya.";
  } else if (outlier) {
    verdict = "normalisasi";
    level = "info";
    summary = "Penurunan wajar: angka bulan lalu terangkat satu konten viral. Performa tipikal tidak memburuk (jumlah konten & ER stabil) — ini normalisasi, bukan kemunduran.";
  } else {
    verdict = "distribusi";
    level = "info";
    summary = "Jumlah konten & ER stabil — perlambatan kemungkinan dari distribusi algoritma atau faktor musiman, di luar kendali tim. Pantau 2–4 minggu sebelum mengubah strategi.";
  }

  return { verdict, level, summary, growth: { prev: prevG, cur: curG }, findings };
}
