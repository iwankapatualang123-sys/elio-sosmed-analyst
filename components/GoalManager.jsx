// File: components/GoalManager.jsx
// Kelola target per cabang & platform (halaman Pengaturan). Tiap cabang punya 2
// baris (TikTok/Instagram) berisi input Views/ER/Follower + tombol Simpan sendiri
// (server action setAccountGoal, upsert per cabang+platform). Prefill dari goalMap.

"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { setAccountGoal } from "@/app/settings/actions";

const PLATFORMS = [
  { key: "tiktok", label: "TikTok", icon: "🎵" },
  { key: "instagram", label: "Instagram", icon: "📸" },
];

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60" style={{ background: "linear-gradient(180deg,#0a8291,#006674)" }}>
      {pending ? "…" : "Simpan"}
    </button>
  );
}

function GoalRow({ accountId, platform, goal }) {
  const [saved, setSaved] = useState(false);
  async function onSubmit(formData) {
    setSaved(false);
    await setAccountGoal(formData);
    setSaved(true);
  }
  return (
    <form action={onSubmit} className="flex flex-wrap items-center gap-2 py-1.5">
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="platform" value={platform.key} />
      <span className="w-24 shrink-0 text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>{platform.icon} {platform.label}</span>
      <input name="target_total_views" defaultValue={goal?.target_total_views ?? ""} inputMode="numeric" placeholder="Views" title="Target total views" className="input-3d !min-h-0 !py-1.5 w-24 text-sm" />
      <input name="target_engagement_rate" defaultValue={goal?.target_engagement_rate ?? ""} inputMode="decimal" placeholder="ER %" title="Target engagement rate (%)" className="input-3d !min-h-0 !py-1.5 w-20 text-sm" />
      <input name="target_net_followers" defaultValue={goal?.target_net_followers ?? ""} inputMode="numeric" placeholder="Follower" title="Target net follower" className="input-3d !min-h-0 !py-1.5 w-24 text-sm" />
      <SaveBtn />
      {saved && <span className="text-xs font-semibold" style={{ color: "#166534" }}>✓</span>}
    </form>
  );
}

export default function GoalManager({ branches = [], goalMap = {} }) {
  if (branches.length === 0) {
    return <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Belum ada cabang aktif. Tambah cabang dulu di atas.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="hidden flex-wrap items-center gap-2 px-1 text-[11px] font-semibold sm:flex" style={{ color: "var(--ink-soft)" }}>
        <span className="w-24 shrink-0">Platform</span>
        <span className="w-24">Views</span>
        <span className="w-20">ER %</span>
        <span className="w-24">Follower</span>
      </div>
      {branches.map((b) => (
        <div key={b.id} className="rounded-xl p-3" style={{ border: "1px solid rgba(0,60,68,.1)" }}>
          <div className="mb-1 text-sm font-semibold text-ink">{b.nama_cabang}{b.tiktok_username ? <span className="font-normal" style={{ color: "var(--ink-soft)" }}> @{b.tiktok_username}</span> : null}</div>
          {PLATFORMS.map((p) => (
            <GoalRow key={p.key} accountId={b.id} platform={p} goal={goalMap[`${b.id}|${p.key}`]} />
          ))}
        </div>
      ))}
    </div>
  );
}
