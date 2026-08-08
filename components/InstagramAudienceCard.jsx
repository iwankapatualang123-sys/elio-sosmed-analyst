// File: components/InstagramAudienceCard.jsx
// Kartu input "Pemirsa" (Audience) Instagram di halaman Upload. Dua cara isi:
//  1) BACA OTOMATIS — upload screenshot/PDF Pemirsa; dibaca model vision (Groq) lalu
//     mengisi field sebagai DRAF. WAJIB dicek/dikoreksi karena AI bisa meleset.
//  2) KETIK MANUAL — isi/koreksi sendiri.
// Semua field editable; simpan via server action saveInstagramAudience (upsert per
// cabang+tanggal). Total follower sekaligus jadi jangkar grafik follower IG.

"use client";

import { useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Users, CheckCircle2, ScanLine, Loader2 } from "lucide-react";
import { saveInstagramAudience } from "@/app/upload/actions";

const AGE_BRACKETS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const numStr = (v) => (v == null ? "" : String(v));

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
  const [autofilled, setAutofilled] = useState(null); // null | "csv" | "vision"
  const [ocr, setOcr] = useState({ loading: false, error: null });
  const fileRef = useRef(null);

  // Field terkontrol (supaya bisa diisi otomatis lalu dikoreksi).
  const [followers, setFollowers] = useState("");
  const [female, setFemale] = useState("");
  const [male, setMale] = useState("");
  const [cities, setCities] = useState("");
  const [countries, setCountries] = useState("");
  const [age, setAge] = useState(AGE_BRACKETS.map(() => ({ female: "", male: "" })));

  async function onSubmit(formData) {
    setResult(null);
    try {
      await saveInstagramAudience(formData);
      setResult({ ok: true });
    } catch (err) {
      setResult({ error: err?.message || "Gagal menyimpan." });
    }
  }

  async function onPickFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcr({ loading: true, error: null });
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/ig-audience-ocr", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.ok) { setOcr({ loading: false, error: json.error || "Gagal membaca gambar." }); return; }
      const d = json.data;
      setFollowers(numStr(d.followers));
      setFemale(numStr(d.female_pct));
      setMale(numStr(d.male_pct));
      setAge(AGE_BRACKETS.map((b, i) => {
        const r = (d.age || []).find((x) => x.bracket === b) || {};
        return { female: numStr(r.female), male: numStr(r.male) };
      }));
      setCities((d.cities || []).join("\n"));
      setCountries((d.countries || []).map((c) => `${c.name}${c.pct != null ? ` ${String(c.pct).replace(".", ",")}%` : ""}`).join("\n"));
      const hasDetail = (d.age || []).some((x) => x.female != null || x.male != null) || (d.cities || []).length || (d.countries || []).length;
      if (hasDetail) setOpen(true);
      setAutofilled(json.source || "vision");
      setOcr({ loading: false, error: null });
    } catch (err) {
      setOcr({ loading: false, error: err?.message || "Gagal menghubungi server." });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <section className="card-3d p-5 sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <Users size={18} style={{ color: "#a12472" }} />
        <h2 className="text-base font-semibold text-ink">Pemirsa Instagram (demografi)</h2>
      </div>
      <p className="mb-3 text-sm" style={{ color: "var(--ink-soft)" }}>
        Dari Meta Business Suite → <b>Pemirsa</b>. Hanya <b>total follower</b> yang wajib; sisanya opsional. Input ulang di
        tanggal sama akan menimpa (koreksi). Total follower juga otomatis mengisi grafik follower IG.
      </p>

      {/* Baca otomatis */}
      <div className="mb-4 rounded-xl p-3" style={{ background: "rgba(193,53,132,.05)", border: "1px dashed rgba(193,53,132,.35)" }}>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={ocr.loading}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "#a12472" }}
          >
            {ocr.loading ? <Loader2 size={15} className="animate-spin" /> : <ScanLine size={15} />}
            {ocr.loading ? "Membaca file…" : "Baca otomatis dari CSV / gambar / PDF"}
          </button>
          <span className="text-[11px]" style={{ color: "var(--ink-soft)" }}>
            Upload file <b>CSV</b> Pemirsa (paling akurat, tanpa AI) — atau screenshot/PDF. Angkanya diisi otomatis, lalu <b>cek</b> sebelum simpan.
          </span>
          <input ref={fileRef} type="file" accept="image/*,application/pdf,.csv,text/csv" onChange={onPickFile} className="hidden" />
        </div>
        {ocr.error && <p className="mt-2 text-[12px]" style={{ color: "#b91c1c" }}>{ocr.error}</p>}
        {autofilled === "csv" && !ocr.error && (
          <p className="mt-2 text-[12px] font-medium" style={{ color: "#166534" }}>
            ✓ Terbaca dari CSV (akurat). Tinggal isi <b>Total pengikut</b> — angka itu tidak ada di file CSV.
          </p>
        )}
        {autofilled === "vision" && !ocr.error && (
          <p className="mt-2 text-[12px] font-medium" style={{ color: "#a15230" }}>
            ⚠ Terisi otomatis dari gambar (AI) — <b>cek dulu</b> semua angka (khususnya usia, hasil perkiraan) sebelum menyimpan.
          </p>
        )}
      </div>

      <form action={onSubmit} className="flex flex-col gap-4">
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
            <input name="followers" value={followers} onChange={(e) => setFollowers(e.target.value)} inputMode="numeric" placeholder="mis. 11.678" className="input-3d" required />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">% Perempuan</span>
              <input name="female_pct" value={female} onChange={(e) => setFemale(e.target.value)} inputMode="decimal" placeholder="mis. 59,7" className="input-3d" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">% Laki-laki</span>
              <input name="male_pct" value={male} onChange={(e) => setMale(e.target.value)} inputMode="decimal" placeholder="mis. 40,3" className="input-3d" />
            </label>
          </div>
        </div>

        <button type="button" onClick={() => setOpen((o) => !o)} className="self-start text-xs font-semibold" style={{ color: "#a12472" }}>
          {open ? "− Sembunyikan detail (usia, kota, negara)" : "+ Tambah detail (usia, kota, negara) — opsional"}
        </button>

        {open && (
          <div className="flex flex-col gap-4 rounded-xl p-3" style={{ background: "rgba(193,53,132,.04)", border: "1px solid rgba(193,53,132,.15)" }}>
            <div>
              <p className="mb-2 text-xs font-semibold text-ink">Distribusi usia (% per rentang)</p>
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
                        <td className="py-1 pr-2"><input name={`age_f_${i}`} value={age[i].female} onChange={(e) => setAge((a) => a.map((row, j) => j === i ? { ...row, female: e.target.value } : row))} inputMode="decimal" placeholder="0" className="input-3d !min-h-0 !py-1 w-20 text-sm" /></td>
                        <td className="py-1 pr-2"><input name={`age_m_${i}`} value={age[i].male} onChange={(e) => setAge((a) => a.map((row, j) => j === i ? { ...row, male: e.target.value } : row))} inputMode="decimal" placeholder="0" className="input-3d !min-h-0 !py-1 w-20 text-sm" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Kota populer <span className="font-normal" style={{ color: "var(--ink-soft)" }}>(satu per baris, urut populer)</span></span>
                <textarea name="cities" value={cities} onChange={(e) => setCities(e.target.value)} rows={5} placeholder={"Sumberpucung, East Java\nKepanjen, East Java"} className="input-3d text-sm" style={{ minHeight: 0 }} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Negara populer <span className="font-normal" style={{ color: "var(--ink-soft)" }}>(format: Nama 97,6%)</span></span>
                <textarea name="countries" value={countries} onChange={(e) => setCountries(e.target.value)} rows={5} placeholder={"Indonesia 97,6%\nMalaysia 0,8%"} className="input-3d text-sm" style={{ minHeight: 0 }} />
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
