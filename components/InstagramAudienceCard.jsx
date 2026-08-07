// File: components/InstagramAudienceCard.jsx
// Kartu input manual "Pemirsa" (Audience) Instagram di halaman Upload. Export
// Pemirsa Meta berupa GAMBAR/PDF (tak bisa dibaca otomatis), jadi angkanya diketik
// dari layar: total follower + gender + distribusi usia + kota & negara populer.
// Simpan via server action saveInstagramAudience (upsert per cabang+tanggal); total
// follower sekaligus jadi jangkar grafik follower IG.

"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Users, CheckCircle2 } from "lucide-react";
import { saveInstagramAudience } from "@/app/upload/actions";

const AGE_BRACKETS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "linear-gradient(180deg,#c956a0,#a12472)" }}>
      {pending ? "Menyimpan…" : "Simpan Pemirsa IG"}
    </button>
  );
}

export default function InstagramAudienceCard({ branches = [] }) {
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const [result, setResult] = useState(null);
  const [open, setOpen] = useState(false);

  async function onSubmit(formData) {
    setResult(null);
    try {
      await saveInstagramAudience(formData);
      setResult({ ok: true });
    } catch (err) {
      setResult({ error: err?.message || "Gagal menyimpan." });
    }
  }

  return (
    <section className="card-3d p-5 sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <Users size={18} style={{ color: "#a12472" }} />
        <h2 className="text-base font-semibold text-ink">Pemirsa Instagram (demografi)</h2>
      </div>
      <p className="mb-4 text-sm" style={{ color: "var(--ink-soft)" }}>
        Dari Meta Business Suite → <b>Pemirsa</b>. Karena ekspornya berupa gambar, angkanya diketik manual di sini
        (cukup <b>sekali sebulan</b>). Hanya <b>total follower</b> yang wajib; sisanya opsional. Input ulang di tanggal
        sama akan menimpa (koreksi). Total follower juga otomatis mengisi grafik follower IG.
      </p>

      <form action={onSubmit} className="flex flex-col gap-4">
        {/* Baris utama */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Cabang</span>
            <select name="accountId" className="input-3d" required>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.nama_cabang}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Tanggal</span>
            <input type="date" name="snapshot_date" defaultValue={today} max={today} className="input-3d" required />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Total pengikut <span style={{ color: "#b91c1c" }}>*</span></span>
            <input name="followers" inputMode="numeric" placeholder="mis. 11.678" className="input-3d" required />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">% Perempuan</span>
              <input name="female_pct" inputMode="decimal" placeholder="mis. 59,7" className="input-3d" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">% Laki-laki</span>
              <input name="male_pct" inputMode="decimal" placeholder="mis. 40,3" className="input-3d" />
            </label>
          </div>
        </div>

        {/* Detail opsional (usia + kota + negara) — disembunyikan agar form tidak ramai */}
        <button type="button" onClick={() => setOpen((o) => !o)} className="self-start text-xs font-semibold" style={{ color: "#a12472" }}>
          {open ? "− Sembunyikan detail (usia, kota, negara)" : "+ Tambah detail (usia, kota, negara) — opsional"}
        </button>

        {open && (
          <div className="flex flex-col gap-4 rounded-xl p-3" style={{ background: "rgba(193,53,132,.04)", border: "1px solid rgba(193,53,132,.15)" }}>
            {/* Usia */}
            <div>
              <p className="mb-2 text-xs font-semibold text-ink">Distribusi usia (% per rentang) — dari grafik "Usia &amp; jenis kelamin"</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr style={{ color: "var(--ink-soft)" }}>
                      <th className="py-1 pr-2 text-[11px] font-medium">Rentang</th>
                      <th className="py-1 pr-2 text-[11px] font-medium">% Perempuan</th>
                      <th className="py-1 pr-2 text-[11px] font-medium">% Laki-laki</th>
                    </tr>
                  </thead>
                  <tbody>
                    {AGE_BRACKETS.map((b, i) => (
                      <tr key={b}>
                        <td className="py-1 pr-2 font-medium text-ink">{b}</td>
                        <td className="py-1 pr-2"><input name={`age_f_${i}`} inputMode="decimal" placeholder="0" className="input-3d !min-h-0 !py-1 w-20 text-sm" /></td>
                        <td className="py-1 pr-2"><input name={`age_m_${i}`} inputMode="decimal" placeholder="0" className="input-3d !min-h-0 !py-1 w-20 text-sm" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Kota populer <span className="font-normal" style={{ color: "var(--ink-soft)" }}>(satu per baris, urut populer)</span></span>
                <textarea name="cities" rows={5} placeholder={"Sumberpucung, East Java\nKepanjen, East Java\nKota Malang, Jawa Timur"} className="input-3d text-sm" style={{ minHeight: 0 }} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Negara populer <span className="font-normal" style={{ color: "var(--ink-soft)" }}>(format: Nama 97,6%)</span></span>
                <textarea name="countries" rows={5} placeholder={"Indonesia 97,6%\nMalaysia 0,8%\nAmerika Serikat 0,4%"} className="input-3d text-sm" style={{ minHeight: 0 }} />
              </label>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          {result?.ok && <span className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: "#166534" }}><CheckCircle2 size={16} /> Tersimpan.</span>}
          {result?.error && <span className="text-sm" style={{ color: "#b91c1c" }}>{result.error}</span>}
          <SaveButton />
        </div>
      </form>
    </section>
  );
}
