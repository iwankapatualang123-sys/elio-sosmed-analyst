// File: components/SocialSnapshotCard.jsx
// Kartu input manual snapshot akun Instagram/Threads di halaman Upload (Lapis 1
// laporan non-TikTok). Ritme yang diharapkan: seminggu sekali, angka disalin dari
// layar IG Insights. Menyimpan lewat server action saveSocialSnapshot (upsert per
// cabang+platform+tanggal, jadi input ulang di hari sama = koreksi).

"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Camera, CheckCircle2 } from "lucide-react";
import { saveSocialSnapshot } from "@/app/upload/actions";
import { SNAPSHOT_PLATFORMS } from "@/lib/social/snapshots";

function fmtNum(n) {
  return n == null ? "—" : new Intl.NumberFormat("id-ID").format(n);
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "linear-gradient(180deg,#0a8291,#006674)" }}>
      {pending ? "Menyimpan…" : "Simpan snapshot"}
    </button>
  );
}

export default function SocialSnapshotCard({ branches = [], latest = [] }) {
  // Tanggal default = hari ini (lokal browser), sekali hitung saat mount.
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const [result, setResult] = useState(null); // {ok} | {error} | null

  async function onSubmit(formData) {
    setResult(null);
    try {
      await saveSocialSnapshot(formData);
      setResult({ ok: true });
    } catch (err) {
      setResult({ error: err?.message || "Gagal menyimpan." });
    }
  }

  const platformLabel = (key) => SNAPSHOT_PLATFORMS.find((p) => p.key === key)?.label || key;

  return (
    <section className="card-3d p-5 sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <Camera size={18} style={{ color: "var(--teal-900)" }} />
        <h2 className="text-base font-semibold text-ink">Input manual Instagram / Threads</h2>
      </div>
      <p className="mb-4 text-sm" style={{ color: "var(--ink-soft)" }}>
        Instagram/Threads belum bisa export report seperti TikTok Studio, jadi perkembangan akun dicatat manual:
        buka <b>IG Insights</b>, salin angkanya ke sini <b>seminggu sekali</b> (mis. tiap Senin). Input ulang di
        tanggal yang sama akan menimpa angka tanggal itu (untuk koreksi).
      </p>

      <form action={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Cabang</span>
          <select name="accountId" className="input-3d" required>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.nama_cabang}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Platform</span>
          <select name="platform" className="input-3d">
            {SNAPSHOT_PLATFORMS.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Tanggal snapshot</span>
          <input type="date" name="snapshot_date" defaultValue={today} max={today} className="input-3d" required />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Followers <span style={{ color: "#b91c1c" }}>*</span></span>
          <input name="followers" inputMode="numeric" placeholder="mis. 1.234" className="input-3d" required />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Reach 30 hari <span className="font-normal" style={{ color: "var(--ink-soft)" }}>(opsional)</span></span>
          <input name="reach_30d" inputMode="numeric" placeholder="mis. 5.600" className="input-3d" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Kunjungan profil 30 hari <span className="font-normal" style={{ color: "var(--ink-soft)" }}>(opsional)</span></span>
          <input name="profile_visits" inputMode="numeric" placeholder="mis. 890" className="input-3d" />
        </label>

        <div className="flex items-center justify-end gap-3 sm:col-span-2">
          {result?.ok && (
            <span className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: "#166534" }}>
              <CheckCircle2 size={16} /> Tersimpan.
            </span>
          )}
          {result?.error && <span className="text-sm" style={{ color: "#b91c1c" }}>{result.error}</span>}
          <SaveButton />
        </div>
      </form>

      {latest.length > 0 && (
        <div className="mt-4 border-t pt-3" style={{ borderColor: "rgba(0,60,68,.1)" }}>
          <p className="mb-1.5 text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>Input terakhir per cabang</p>
          <ul className="space-y-0.5 text-[13px]">
            {latest.map((s) => (
              <li key={`${s.accountId}-${s.platform}`} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-ink">{s.branch} · {platformLabel(s.platform)}</span>
                <span className="shrink-0" style={{ color: "var(--ink-soft)" }}>
                  {s.snapshot_date} — <b className="text-ink">{fmtNum(s.followers)}</b> followers
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
