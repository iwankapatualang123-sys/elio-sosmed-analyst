// File: components/GoalManager.jsx
// Kelola target per BULAN × OUTLET × PLATFORM (halaman Pengaturan).
// Pemilih Bulan / Outlet / Platform + input target + tombol Simpan. Saat ketiga
// pemilih berubah, input target ter-prefill otomatis dari target yang sudah ada
// (goalMap keyed `accountId|platform|month`). Simpan -> server action
// setAccountGoal (upsert per kombinasi).

"use client";

import { useMemo, useState } from "react";
import { setAccountGoal } from "@/app/settings/actions";

const PLATFORMS = [
  { key: "tiktok", label: "🎵 TikTok" },
  { key: "instagram", label: "📸 Instagram" },
];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
function labelBulan(ym) {
  const [y, m] = String(ym).split("-");
  return `${BULAN[Number(m) - 1] || m} ${y}`;
}

export default function GoalManager({ branches = [], goalMap = {}, monthOptions = [] }) {
  const [month, setMonth] = useState(monthOptions[0] || "");
  const [outlet, setOutlet] = useState(branches[0]?.id || "");
  const [platform, setPlatform] = useState("tiktok");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null); // {ok}|{error}|null

  // Target tersimpan untuk kombinasi terpilih (untuk prefill). Pakai `key` sbg
  // remount trigger supaya defaultValue input ikut ganti saat pemilih berubah.
  const key = `${outlet}|${platform}|${month}`;
  const existing = goalMap[key] || null;

  const branchName = useMemo(() => branches.find((b) => b.id === outlet)?.nama_cabang || "", [branches, outlet]);

  async function onSubmit(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setResult(null);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("accountId", outlet);
      fd.set("platform", platform);
      fd.set("target_month", month);
      await setAccountGoal(fd);
      setResult({ ok: true });
    } catch (err) {
      setResult({ error: err?.message || "Gagal menyimpan." });
    } finally {
      setSaving(false);
    }
  }

  if (branches.length === 0) {
    return <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Belum ada cabang aktif. Tambah cabang dulu di atas.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {/* Pemilih Bulan / Outlet / Platform */}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Bulan</span>
          <select value={month} onChange={(e) => { setMonth(e.target.value); setResult(null); }} className="input-3d">
            {monthOptions.map((m) => <option key={m} value={m}>{labelBulan(m)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Outlet</span>
          <select value={outlet} onChange={(e) => { setOutlet(e.target.value); setResult(null); }} className="input-3d">
            {branches.map((b) => <option key={b.id} value={b.id}>{b.nama_cabang}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Platform</span>
          <select value={platform} onChange={(e) => { setPlatform(e.target.value); setResult(null); }} className="input-3d">
            {PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </label>
      </div>

      {/* Input target (prefill otomatis via key -> remount) */}
      <div key={key} className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Target Views</span>
          <input name="target_total_views" defaultValue={existing?.target_total_views ?? ""} inputMode="numeric" placeholder="mis. 500000" className="input-3d" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Target Engagement Rate (%)</span>
          <input name="target_engagement_rate" defaultValue={existing?.target_engagement_rate ?? ""} inputMode="decimal" placeholder="mis. 4" className="input-3d" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Target Net Follower</span>
          <input name="target_net_followers" defaultValue={existing?.target_net_followers ?? ""} inputMode="numeric" placeholder="mis. 100" className="input-3d" />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "linear-gradient(180deg,#0a8291,#006674)" }}>
          {saving ? "Menyimpan…" : "Simpan target"}
        </button>
        <span className="text-xs" style={{ color: "var(--ink-soft)" }}>
          {labelBulan(month)} · {branchName} · {PLATFORMS.find((p) => p.key === platform)?.label}
          {existing ? " · sudah ada target (akan diperbarui)" : ""}
        </span>
        {result?.ok && <span className="text-sm font-semibold" style={{ color: "#166534" }}>✓ Tersimpan</span>}
        {result?.error && <span className="text-sm" style={{ color: "#b91c1c" }}>{result.error}</span>}
      </div>
    </form>
  );
}
