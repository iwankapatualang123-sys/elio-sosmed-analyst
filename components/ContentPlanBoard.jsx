// File: components/ContentPlanBoard.jsx
// Papan Rencana Konten (client): tabel editable meniru sheet Excel "Content Plan".
// Kolom: No, Post, Status (otomatis), PIC, Headline/Hook, Pillar, Goals, Type, ACC.
// Tambah/edit lewat modal; ACC toggle cepat; hapus dgn konfirmasi. Status Uploaded/
// WIP/Draf dihitung di server (lib/tiktok/content-plan) & dioper via prop `status`.

"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Pencil, Trash2, X, ExternalLink, CheckCircle2, FileSpreadsheet, Download, UploadCloud, ArrowRight, ArrowLeft, Store, Repeat, Clock, UploadCloud as UploadIcon, Ban } from "lucide-react";
import { createPlan, updatePlan, deletePlan, toggleAcc, setPostedUrl, setPlatformLink, analyzePlansExcel, importPlansExcelMapped, replacePlan, unreplacePlan } from "@/app/content-plan/actions";
import { PLATFORM_OPTIONS, planPlatforms, platformLink } from "@/lib/tiktok/content-plan";

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
// Format ringkas ("14 Jul") untuk kolom sempit di tabel; tahun tetap ada di tooltip
// (fmtDateFull) supaya tetap bisa dicek tanpa memakan lebar kolom.
function fmtDate(d) {
  if (!d || !/^\d{4}-\d{2}-\d{2}/.test(d)) return "—";
  const [, m, day] = d.slice(0, 10).split("-");
  return `${Number(day)} ${BULAN[Number(m) - 1]}`;
}
// Gabungkan daftar resmi + nilai saat ini (kalau ada data lama di luar daftar,
// tidak hilang diam-diam saat dropdown dibuka untuk edit).
function optionsWithFallback(list, current) {
  if (current && !list.includes(current)) return [...list, current];
  return list;
}

function fmtDateFull(d) {
  if (!d || !/^\d{4}-\d{2}-\d{2}/.test(d)) return "";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${Number(day)} ${BULAN[Number(m) - 1]} ${y}`;
}

// Gaya & ikon per 5 status siklus konten.
const STATUS_META = {
  "On Going": { bg: "rgba(3,105,161,.1)", fg: "#0369a1", Icon: Clock },
  Uploaded: { bg: "rgba(124,58,237,.1)", fg: "#7c3aed", Icon: UploadIcon },
  Verified: { bg: "rgba(22,101,52,.1)", fg: "#166534", Icon: CheckCircle2 },
  Cancelled: { bg: "rgba(180,83,9,.1)", fg: "#b45309", Icon: Ban },
  Replaced: { bg: "rgba(161,98,7,.1)", fg: "#a16207", Icon: Repeat },
};
// Badge warna status.
function StatusBadge({ status }) {
  const s = STATUS_META[status] || STATUS_META["On Going"];
  const Icon = s.Icon;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: s.bg, color: s.fg }}>
      <Icon size={12} />
      {status || "On Going"}
    </span>
  );
}

// Kolom Status utk rencana MULTI-platform: satu badge status penuh per platform,
// tiap baris tingginya disamakan dgn baris input link di kolom sebelah supaya
// TT sejajar link TT, IG sejajar link IG (tidak menumpuk di bawah 1 badge).
function PlatformStatusRows({ plan }) {
  const keys = planPlatforms(plan);
  return (
    <div className="flex flex-col gap-1">
      {PLATFORM_OPTIONS.filter((o) => keys.includes(o.key)).map((o) => {
        const st = plan.perPlatform?.[o.key]?.status || "On Going";
        const meta = STATUS_META[st] || STATUS_META["On Going"];
        const Icon = meta.Icon;
        return (
          <div key={o.key} className="flex h-[26px] items-center">
            <span
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ background: meta.bg, color: meta.fg }}
              title={`${o.label}: ${st}`}
            >
              <b className="text-[9px]">{o.short}</b>
              <Icon size={10} />
              {st}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Satu field form berlabel.
function Field({ label, children, hint }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="text-[11px]" style={{ color: "var(--ink-soft)" }}>{hint}</span>}
    </label>
  );
}

const EMPTY = {
  id: null, post_date: "", pic: "", headline: "", topic: "", goals_content: "",
  primary_pillar: "", secondary_pillar: "", content_type: "Video", reference_url: "",
  posted_url: "", notes: "", acc_to_posting: false, status_override: "",
  platforms: ["tiktok"], platform_links: {},
};

export default function ContentPlanBoard({ accountId, accounts = [], plans = [], options = {}, pics = [], accCount = 0 }) {
  const [editing, setEditing] = useState(null); // null | {row} | 'new'
  const [replacing, setReplacing] = useState(null); // rencana yang sedang diganti | null
  // Wizard import Excel: upload -> map (pratinjau + peta Outlet->cabang) -> hasil.
  const [importing, setImporting] = useState(false);
  const [importStep, setImportStep] = useState("upload"); // 'upload' | 'map'
  const [importFile, setImportFile] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const [analysis, setAnalysis] = useState(null); // {sheetNames, sheetUsed, totalRows, skippedEmpty, outlets, sample}
  const [outletMap, setOutletMap] = useState({}); // { outletValue: accountId } ("" = tanpa outlet)
  const [importResult, setImportResult] = useState(null); // {inserted, byBranch, ...} | {error}
  const [pending, startTransition] = useTransition();
  const goals = options.goals || [];
  const pillars = options.pillars || [];
  const types = options.types || [];

  const draft = editing === "new" ? EMPTY : editing || null;

  // Submit tambah/edit lalu tutup modal (server sudah revalidate).
  async function onSubmit(formData) {
    if (editing === "new") await createPlan(formData);
    else await updatePlan(formData);
    setEditing(null);
  }

  // Submit "Ganti rencana" (buat baru / tautkan yang ada).
  async function onReplace(formData) {
    await replacePlan(formData);
    setReplacing(null);
  }

  // Batalkan penggantian: rencana lama aktif kembali (hanya lepas tautan, field lain aman).
  function undoReplace(row) {
    if (!confirm("Batalkan penggantian? Rencana ini akan aktif kembali.")) return;
    const fd = new FormData();
    fd.set("id", String(row.id));
    startTransition(() => unreplacePlan(fd));
  }

  // Buka wizard import dari nol.
  function openImport() {
    setImportStep("upload");
    setImportFile(null);
    setAnalysis(null);
    setOutletMap({});
    setImportResult(null);
    setImporting(true);
  }

  // Tebak cabang untuk sebuah nilai Outlet: cocokkan teks ke nama/username cabang.
  // Outlet kosong ("") default ke cabang yang sedang dipilih di halaman.
  function guessAccount(outletValue) {
    if (!outletValue) return accountId;
    const q = outletValue.toLowerCase().trim();
    const hit = accounts.find((a) => {
      const nm = String(a.nama_cabang || "").toLowerCase();
      const un = String(a.tiktok_username || "").toLowerCase();
      return nm.includes(q) || q.includes(nm.replace(" (diarsipkan)", "").trim()) || (un && (un.includes(q) || q.includes(un)));
    });
    return hit ? hit.id : "";
  }

  // LANGKAH 1: analisa file (opsional sheet tertentu) lalu ke langkah pratinjau.
  async function runAnalyze(file, sheetName) {
    if (!file) return;
    setImportBusy(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      if (sheetName) fd.set("sheetName", sheetName);
      const res = await analyzePlansExcel(fd);
      setAnalysis(res);
      // Inisialisasi peta Outlet -> cabang dengan tebakan otomatis.
      const map = {};
      for (const o of res.outlets) map[o.value] = guessAccount(o.value);
      setOutletMap(map);
      setImportStep("map");
    } catch (err) {
      setImportResult({ error: err?.message || "Gagal menganalisa file." }); // tampil di langkah unggah
    } finally {
      setImportBusy(false);
    }
  }

  // LANGKAH 2: jalankan import dengan peta Outlet->cabang.
  async function runImport() {
    if (!importFile) return;
    setImportBusy(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.set("file", importFile);
      if (analysis?.sheetUsed) fd.set("sheetName", analysis.sheetUsed);
      fd.set("mapping", JSON.stringify({ byOutlet: outletMap }));
      const res = await importPlansExcelMapped(fd);
      setImportResult(res);
    } catch (err) {
      setImportResult({ error: err?.message || "Gagal import." });
    } finally {
      setImportBusy(false);
    }
  }

  function removeRow(id) {
    if (!confirm("Hapus baris rencana ini?")) return;
    const fd = new FormData();
    fd.set("id", String(id));
    startTransition(() => deletePlan(fd));
  }

  function flipAcc(row) {
    const fd = new FormData();
    fd.set("id", String(row.id));
    fd.set("next", String(!row.acc_to_posting));
    startTransition(() => toggleAcc(fd));
  }

  // Simpan link tayang saat tim selesai mengetik (blur) — hanya jika berubah.
  // TikTok -> posted_url (verifikasi otomatis); IG/Threads -> platform_links.
  function saveLink(row, platform, value) {
    const next = value.trim();
    if (next === platformLink(row, platform)) return;
    const fd = new FormData();
    fd.set("id", String(row.id));
    fd.set("platform", platform);
    fd.set("posted_url", next);
    startTransition(() => (platform === "tiktok" ? setPostedUrl(fd) : setPlatformLink(fd)));
  }

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
          {plans.length} baris rencana · <b>{accCount}</b> sudah ACC. Tempel <b>Link tayang</b> per platform setelah upload (TikTok: <b>Uploaded</b> → <b>Verified</b> saat cocok report; IG/Threads: <b>Uploaded</b>). Rencana bulan lampau tanpa link otomatis <b>Cancelled</b>. Platform diatur di form Edit.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openImport}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold"
            style={{ border: "1px solid rgba(0,60,68,.2)", color: "var(--teal-900)", background: "#fff" }}
            title="Unggah banyak rencana sekaligus dari file Excel (bisa banyak cabang via kolom Outlet)"
          >
            <FileSpreadsheet size={16} /> Import Excel
          </button>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-white"
            style={{ background: "linear-gradient(180deg,#0a8291,#006674)", boxShadow: "0 6px 14px -4px rgba(0,60,68,.5)" }}
          >
            <Plus size={16} /> Tambah rencana
          </button>
        </div>
      </div>

      <div className="overflow-auto rounded-xl" style={{ maxHeight: 620, border: "1px solid rgba(0,60,68,.1)" }}>
        <table className="w-full text-left text-sm" style={{ tableLayout: "fixed" }}>
          {/* Lebar kolom tetap: Post/Status/PIC dipersempit, Headline diperlebar
              supaya jadi fokus utama tabel — bukan mengikuti isi teks otomatis. */}
          <colgroup>
            <col style={{ width: 36 }} />
            <col style={{ width: 52 }} />
            <col style={{ width: 118 }} />
            <col style={{ width: 152 }} />
            <col style={{ width: 50 }} />
            <col style={{ width: 284 }} />
            <col style={{ width: 68 }} />
            <col style={{ width: 108 }} />
            <col style={{ width: 88 }} />
            <col style={{ width: 68 }} />
            <col style={{ width: 44 }} />
            <col style={{ width: 132 }} />
          </colgroup>
          <thead className="sticky top-0 z-10" style={{ background: "linear-gradient(180deg,#eaf5ec,#dcefe0)" }}>
            <tr>
              {["No", "Post", "Status", "Link tayang", "PIC", "Headline / Hook", "Referensi", "Primary Pillar", "Goals", "Type", "ACC", "Aksi"].map((h, idx, arr) => (
                <th
                  key={h}
                  className="whitespace-nowrap overflow-hidden text-ellipsis px-1.5 py-2 text-[11px] font-semibold text-ink"
                  style={idx === arr.length - 1 ? { position: "sticky", right: 0, background: "#dcefe0", zIndex: 11, textAlign: "center" } : undefined}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 ? (
              <tr><td colSpan={12} className="px-3 py-8 text-center" style={{ color: "var(--ink-soft)" }}>Belum ada rencana. Klik “Tambah rencana”.</td></tr>
            ) : (
              plans.map((p, i) => {
                const dim = p.status === "Replaced" || p.status === "Cancelled";
                return (
                <tr key={p.id} className="border-t align-middle" style={{ borderColor: "rgba(0,60,68,.08)", opacity: dim ? 0.6 : 1 }}>
                  <td className="px-1.5 py-1.5 text-[10px]" style={{ color: "var(--ink-soft)" }}>{p.seq || i + 1}</td>
                  <td className="overflow-hidden text-ellipsis whitespace-nowrap px-1.5 py-1.5 text-[10px]" title={fmtDateFull(p.post_date)}>{fmtDate(p.post_date)}</td>
                  <td className="overflow-hidden px-1.5 py-1.5">
                    {planPlatforms(p).length > 1 ? <PlatformStatusRows plan={p} /> : <StatusBadge status={p.status} />}
                    {p.match && (
                      <div className="mt-1 max-w-[108px] truncate text-[9px]" style={{ color: "#166534" }} title={p.match.video_title}>
                        ✓ {p.match.video_title}
                      </div>
                    )}
                    {!p.match && p.hint && p.status !== "Replaced" && (
                      <div className="mt-1 max-w-[108px] truncate text-[9px]" style={{ color: "var(--ink-soft)" }} title={`Mungkin sudah tayang — tempel linknya untuk verifikasi: ${p.hint.video_title}`}>
                        💡 {p.hint.video_title}
                      </div>
                    )}
                    {p.status === "Replaced" && (
                      <div className="mt-1 max-w-[108px] truncate text-[9px]" style={{ color: "#a16207" }} title={p.replaced_by?.headline ? `Digantikan oleh: ${p.replaced_by.headline}` : "Digantikan oleh rencana lain"}>
                        ↪ {p.replaced_by?.headline || "rencana lain"}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {/* Satu input link per platform target. TikTok terverifikasi otomatis
                        vs data report; IG/Threads berbasis link saja (Uploaded). */}
                    {PLATFORM_OPTIONS.filter((o) => planPlatforms(p).includes(o.key)).map((o, idx, arr) => {
                      const val = platformLink(p, o.key);
                      const multi = arr.length > 1;
                      return (
                        <div key={o.key} className={`flex h-[26px] items-center gap-1${idx > 0 ? " mt-1" : ""}`}>
                          {multi && <span className="w-5 shrink-0 text-[9px] font-bold" style={{ color: "var(--ink-soft)" }}>{o.short}</span>}
                          <input
                            type="url"
                            defaultValue={val}
                            onBlur={(e) => saveLink(p, o.key, e.target.value)}
                            placeholder={multi ? `link ${o.label}…` : "tempel link…"}
                            disabled={pending}
                            className="input-3d !min-h-0 !py-1 !px-2 text-[11px]"
                            style={{ width: "100%", minWidth: 0 }}
                            title={o.key === "tiktok"
                              ? "Tempel link konten TikTok yang sudah tayang. Status jadi Verified bila cocok data report."
                              : `Tempel link konten ${o.label} yang sudah tayang (status jadi Uploaded).`}
                          />
                          {val && (
                            <a href={val} target="_blank" rel="noopener noreferrer" className="shrink-0" style={{ color: "var(--teal-900)" }} title={`Buka link ${o.label}`}>
                              <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </td>
                  <td className="overflow-hidden text-ellipsis whitespace-nowrap px-1.5 py-1.5 text-[10px]" title={p.pic || ""}>{p.pic || "—"}</td>
                  <td className="px-2 py-1.5">
                    <div>
                      <div className="line-clamp-2 text-[11px] font-semibold leading-snug text-ink">{p.headline || <span style={{ color: "var(--ink-soft)" }}>—</span>}</div>
                      {p.topic && <div className="mt-0.5 line-clamp-1 text-[9.5px] leading-snug" style={{ color: "var(--ink-soft)" }} title={p.topic}>{p.topic}</div>}
                    </div>
                  </td>
                  <td className="overflow-hidden px-1.5 py-1.5">
                    {p.reference_url ? (
                      <a href={p.reference_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-semibold" style={{ color: "var(--teal-900)" }} title={p.reference_url}>
                        <ExternalLink size={10} /> Buka
                      </a>
                    ) : (
                      <span className="text-[10px]" style={{ color: "var(--ink-soft)" }}>—</span>
                    )}
                  </td>
                  <td className="overflow-hidden text-ellipsis px-1.5 py-1.5 text-[10px]" title={[p.primary_pillar, p.secondary_pillar].filter(Boolean).join(" + ")}>
                    {p.primary_pillar || "—"}
                    {p.secondary_pillar ? <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[9px]" style={{ color: "var(--ink-soft)" }}>+ {p.secondary_pillar}</div> : null}
                  </td>
                  <td className="overflow-hidden text-ellipsis whitespace-nowrap px-1.5 py-1.5 text-[10px]" title={p.goals_content || ""}>{p.goals_content || "—"}</td>
                  <td className="overflow-hidden text-ellipsis whitespace-nowrap px-1.5 py-1.5 text-[10px]" title={p.content_type || ""}>{p.content_type || "—"}</td>
                  <td className="px-2.5 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={!!p.acc_to_posting}
                      onChange={() => flipAcc(p)}
                      disabled={pending}
                      className="h-4 w-4 accent-[#0a8291]"
                      title={p.acc_to_posting ? "Sudah ACC untuk posting" : "Belum ACC"}
                    />
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-1.5" style={{ position: "sticky", right: 0, background: "#fff", boxShadow: "-8px 0 10px -8px rgba(0,60,68,.2)" }}>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing({ ...EMPTY, ...p, post_date: (p.post_date || "").slice(0, 10) })}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold hover:brightness-95"
                        style={{ color: "#fff", background: "linear-gradient(180deg,#0a8291,#006674)" }}
                        title="Edit rencana ini"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      {p.status === "Replaced" ? (
                        <button type="button" onClick={() => undoReplace(p)} className="rounded-lg p-1 hover:bg-amber-50" title="Batalkan penggantian (aktifkan lagi)">
                          <Repeat size={14} style={{ color: "#a16207" }} />
                        </button>
                      ) : (
                        <button type="button" onClick={() => setReplacing(p)} className="rounded-lg p-1 hover:bg-amber-50" title="Ganti rencana ini dengan rencana lain">
                          <Repeat size={14} style={{ color: "var(--ink-soft)" }} />
                        </button>
                      )}
                      <button type="button" onClick={() => removeRow(p.id)} className="rounded-lg p-1 hover:bg-red-50" title="Hapus">
                        <Trash2 size={14} className="text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Wizard import Excel: upload -> map (pratinjau + peta Outlet->cabang) -> hasil */}
      {importing && (
        <ImportWizard
          accounts={accounts}
          accountId={accountId}
          step={importStep}
          setStep={setImportStep}
          file={importFile}
          setFile={setImportFile}
          busy={importBusy}
          analysis={analysis}
          outletMap={outletMap}
          setOutletMap={setOutletMap}
          result={importResult}
          setResult={setImportResult}
          onAnalyze={runAnalyze}
          onImport={runImport}
          onClose={() => setImporting(false)}
          reset={openImport}
        />
      )}

      {/* Modal Ganti rencana */}
      {replacing && (
        <ReplaceModal
          old={replacing}
          accountId={accountId}
          plans={plans}
          options={{ goals, pillars, types }}
          pics={pics}
          onSubmit={onReplace}
          onClose={() => setReplacing(null)}
        />
      )}

      {/* Modal tambah/edit */}
      {draft && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto p-4" style={{ background: "rgba(0,36,42,.45)" }} onClick={() => setEditing(null)}>
          <div className="my-6 w-full max-w-2xl rounded-2xl bg-white p-5 sm:p-6" style={{ boxShadow: "0 24px 60px -12px rgba(0,36,42,.6)" }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink">{editing === "new" ? "Tambah rencana konten" : "Edit rencana konten"}</h3>
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg p-1 hover:bg-[rgba(0,60,68,.06)]"><X size={20} /></button>
            </div>

            <form action={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {editing !== "new" && <input type="hidden" name="id" value={draft.id} />}

              <div className="sm:col-span-2">
                <Field
                  label="Cabang"
                  hint={editing === "new"
                    ? "Rencana ini akan tersimpan untuk cabang yang dipilih di sini."
                    : "Ubah untuk MEMINDAHKAN rencana ini ke cabang lain (mis. salah outlet). Setelah dipindah, baris akan tampil di cabang tujuan."}
                >
                  <select name="accountId" defaultValue={accountId} className="input-3d">
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.nama_cabang}{a.tiktok_username ? ` (@${a.tiktok_username})` : ""}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Tanggal Post">
                <input type="date" name="post_date" defaultValue={draft.post_date || ""} className="input-3d" />
              </Field>
              <Field label="PIC">
                <select name="pic" defaultValue={draft.pic || ""} className="input-3d">
                  <option value="">— Pilih PIC —</option>
                  {optionsWithFallback(pics, draft.pic).map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </Field>

              <div className="sm:col-span-2">
                <Field label="Headline / Hook" hint="Judul/hook konten. Dipakai mencocokkan status ke konten yang sudah tayang.">
                  <input name="headline" defaultValue={draft.headline || ""} placeholder='mis. "Family Cafe" IG TIKTOK' className="input-3d" />
                </Field>
              </div>

              <div className="sm:col-span-2">
                <Field label="Topic / Redaksi (brief footage)">
                  <textarea name="topic" defaultValue={draft.topic || ""} rows={3} className="input-3d" placeholder="Footage: ..." />
                </Field>
              </div>

              <Field label="Goals Content">
                <select name="goals_content" defaultValue={draft.goals_content || ""} className="input-3d">
                  <option value="">— Pilih Goals —</option>
                  {optionsWithFallback(goals, draft.goals_content).map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </Field>
              <Field label="Type of Content">
                <select name="content_type" defaultValue={draft.content_type || ""} className="input-3d">
                  <option value="">— Pilih Tipe —</option>
                  {optionsWithFallback(types, draft.content_type).map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </Field>

              <Field label="Primary Pillar">
                <select name="primary_pillar" defaultValue={draft.primary_pillar || ""} className="input-3d">
                  <option value="">— Pilih Pillar —</option>
                  {optionsWithFallback(pillars, draft.primary_pillar).map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </Field>
              <Field label="Secondary Pillar">
                <select name="secondary_pillar" defaultValue={draft.secondary_pillar || ""} className="input-3d">
                  <option value="">— Pilih Pillar —</option>
                  {optionsWithFallback(pillars, draft.secondary_pillar).map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </Field>

              <div className="sm:col-span-2">
                <Field label="Reference Content (link referensi/contoh)">
                  <input name="reference_url" type="url" defaultValue={draft.reference_url || ""} placeholder="https://..." className="input-3d" />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <PlatformSection draft={draft} />
              </div>
              <div className="sm:col-span-2">
                <Field label="Keterangan / Konten Pengganti">
                  <textarea name="notes" defaultValue={draft.notes || ""} rows={2} className="input-3d" />
                </Field>
              </div>

              <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                <input type="checkbox" name="acc_to_posting" defaultChecked={!!draft.acc_to_posting} className="h-4 w-4 accent-[#0a8291]" />
                ACC to Posting (siap tayang)
              </label>
              <Field label="Status (opsional)" hint="Kosongkan agar otomatis (On Going/Uploaded/Verified/Cancelled). 'Replaced' diatur lewat tombol Ganti.">
                <select name="status_override" defaultValue={draft.status_override === "Replaced" ? "" : (draft.status_override || "")} className="input-3d">
                  <option value="">— Otomatis —</option>
                  <option value="On Going">On Going</option>
                  <option value="Uploaded">Uploaded</option>
                  <option value="Verified">Verified</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </Field>

              <div className="mt-2 flex items-center justify-end gap-2 sm:col-span-2">
                <button type="button" onClick={() => setEditing(null)} className="rounded-xl px-4 py-2 text-sm font-semibold" style={{ border: "1px solid rgba(0,60,68,.2)", color: "var(--ink)" }}>Batal</button>
                <SubmitButton isNew={editing === "new"} />
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Bagian PLATFORM di modal tambah/edit: centang platform target + link tayang per
// platform yang dicentang. Platform yang TIDAK dicentang tetap mengirim link lamanya
// lewat input hidden supaya nilainya tidak terhapus diam-diam saat disimpan.
function PlatformSection({ draft }) {
  const [checked, setChecked] = useState(() => new Set(planPlatforms(draft)));
  function toggle(key) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return prev; // minimal 1 platform
        next.delete(key);
      } else next.add(key);
      return next;
    });
  }
  const linkName = (key) => (key === "tiktok" ? "posted_url" : `link_${key}`);
  return (
    <div className="flex flex-col gap-2 rounded-xl p-3" style={{ border: "1px solid rgba(0,60,68,.12)", background: "rgba(0,102,116,.03)" }}>
      <span className="text-sm font-semibold text-ink">Platform tayang</span>
      <div className="flex flex-wrap gap-3">
        {PLATFORM_OPTIONS.map((o) => (
          <label key={o.key} className="flex items-center gap-1.5 text-sm font-medium text-ink">
            <input type="checkbox" name="platforms" value={o.key} checked={checked.has(o.key)} onChange={() => toggle(o.key)} className="h-4 w-4 accent-[#0a8291]" />
            {o.label}
          </label>
        ))}
      </div>
      <span className="text-[11px]" style={{ color: "var(--ink-soft)" }}>
        Link TikTok diverifikasi otomatis vs data report (Verified). Instagram/Threads belum punya data report — ada link = <b>Uploaded</b>.
      </span>
      {PLATFORM_OPTIONS.map((o) => {
        const val = platformLink(draft, o.key);
        if (!checked.has(o.key)) {
          // Simpan nilai lama diam-diam supaya tidak hilang saat platform di-uncheck.
          return val ? <input key={o.key} type="hidden" name={linkName(o.key)} value={val} /> : null;
        }
        return (
          <Field key={o.key} label={`Link tayang ${o.label}`}>
            <input
              name={linkName(o.key)}
              type="url"
              defaultValue={val}
              placeholder={o.key === "tiktok" ? "https://www.tiktok.com/@.../video/..." : `https://www.${o.key}.com/...`}
              className="input-3d"
            />
          </Field>
        );
      })}
    </div>
  );
}

// Tombol simpan dgn indikator pending (useFormStatus butuh berada di dalam <form>).
function SubmitButton({ isNew }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "linear-gradient(180deg,#0a8291,#006674)" }}>
      {pending ? "Menyimpan…" : isNew ? "Tambah" : "Simpan"}
    </button>
  );
}

// Tombol submit generik dgn indikator pending.
function PendingButton({ children, disabled }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "linear-gradient(180deg,#0a8291,#006674)" }}>
      <Repeat size={16} /> {pending ? "Memproses…" : children}
    </button>
  );
}

// ————— Modal Ganti rencana (buat baru / tautkan yang sudah ada) —————
function ReplaceModal({ old, accountId, plans = [], options = {}, pics = [], onSubmit, onClose }) {
  const [mode, setMode] = useState("new"); // 'new' | 'existing'
  const goals = options.goals || [];
  const pillars = options.pillars || [];
  const types = options.types || [];
  // Kandidat pengganti (mode existing): semua rencana lain di cabang ini, kecuali diri
  // sendiri & yang sudah berstatus Replaced.
  const candidates = plans.filter((p) => String(p.id) !== String(old.id) && p.status !== "Replaced");

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto p-4" style={{ background: "rgba(0,36,42,.45)" }} onClick={onClose}>
      <div className="my-6 w-full max-w-2xl rounded-2xl bg-white p-5 sm:p-6" style={{ boxShadow: "0 24px 60px -12px rgba(0,36,42,.6)" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold text-ink"><Repeat size={20} /> Ganti rencana</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-[rgba(0,60,68,.06)]"><X size={20} /></button>
        </div>
        <p className="mb-4 text-sm" style={{ color: "var(--ink-soft)" }}>
          Rencana lama <b className="text-ink">“{old.headline || "—"}”</b> akan ditandai <b>Replaced</b> (tetap tampil sebagai histori) dan ditautkan ke penggantinya.
        </p>

        {/* Pilih mode */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          {[["new", "Buat rencana baru"], ["existing", "Pilih yang sudah ada"]].map(([k, lbl]) => (
            <button
              key={k} type="button" onClick={() => setMode(k)}
              className="rounded-xl px-3 py-2 text-sm font-semibold"
              style={mode === k ? { background: "linear-gradient(180deg,#0a8291,#006674)", color: "#fff" } : { border: "1px solid rgba(0,60,68,.2)", color: "var(--ink)" }}
            >
              {lbl}
            </button>
          ))}
        </div>

        <form action={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input type="hidden" name="oldId" value={old.id} />
          <input type="hidden" name="mode" value={mode} />

          {mode === "new" ? (
            <>
              <input type="hidden" name="accountId" value={accountId} />
              <Field label="Tanggal Post">
                <input type="date" name="post_date" defaultValue={(old.post_date || "").slice(0, 10)} className="input-3d" />
              </Field>
              <Field label="PIC">
                <select name="pic" defaultValue={old.pic || ""} className="input-3d">
                  <option value="">— Pilih PIC —</option>
                  {optionsWithFallback(pics, old.pic).map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Headline / Hook (rencana baru)" hint="Isi hook konten pengganti.">
                  <input name="headline" defaultValue="" placeholder='mis. "Family Cafe" versi baru' className="input-3d" autoFocus />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Topic / Redaksi">
                  <textarea name="topic" defaultValue="" rows={2} className="input-3d" placeholder="Footage: ..." />
                </Field>
              </div>
              <Field label="Goals Content">
                <select name="goals_content" defaultValue={old.goals_content || ""} className="input-3d">
                  <option value="">— Pilih Goals —</option>
                  {optionsWithFallback(goals, old.goals_content).map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </Field>
              <Field label="Type of Content">
                <select name="content_type" defaultValue={old.content_type || "Video"} className="input-3d">
                  <option value="">— Pilih Tipe —</option>
                  {optionsWithFallback(types, old.content_type).map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </Field>
              <Field label="Primary Pillar">
                <select name="primary_pillar" defaultValue={old.primary_pillar || ""} className="input-3d">
                  <option value="">— Pilih Pillar —</option>
                  {optionsWithFallback(pillars, old.primary_pillar).map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </Field>
              <Field label="Secondary Pillar">
                <select name="secondary_pillar" defaultValue={old.secondary_pillar || ""} className="input-3d">
                  <option value="">— Pilih Pillar —</option>
                  {optionsWithFallback(pillars, old.secondary_pillar).map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </Field>
            </>
          ) : (
            <div className="sm:col-span-2">
              <Field label="Pilih rencana pengganti" hint="Rencana lain di cabang ini yang jadi pengganti.">
                {candidates.length === 0 ? (
                  <p className="text-sm" style={{ color: "#b45309" }}>Belum ada rencana lain untuk dipilih. Pakai “Buat rencana baru”.</p>
                ) : (
                  <select name="newId" defaultValue="" className="input-3d" required>
                    <option value="" disabled>— Pilih rencana —</option>
                    {candidates.map((p) => (
                      <option key={p.id} value={p.id}>{fmtDate(p.post_date)} · {(p.headline || "(tanpa judul)").slice(0, 60)}</option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          )}

          <div className="mt-2 flex items-center justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold" style={{ border: "1px solid rgba(0,60,68,.2)", color: "var(--ink)" }}>Batal</button>
            <PendingButton disabled={mode === "existing" && candidates.length === 0}>{mode === "new" ? "Buat & Ganti" : "Ganti"}</PendingButton>
          </div>
        </form>
      </div>
    </div>
  );
}

// Nama cabang dari id (untuk ringkasan hasil).
function branchLabel(accounts, id) {
  const a = accounts.find((x) => x.id === id);
  return a ? a.nama_cabang : "—";
}
function fmtDateShort(d) { return d && /^\d{4}-\d{2}-\d{2}/.test(d) ? fmtDate(d) : "—"; }

// ————— Wizard import Excel —————
function ImportWizard({ accounts, accountId, step, setStep, file, setFile, busy, analysis, outletMap, setOutletMap, result, onAnalyze, onImport, onClose, reset }) {
  const mappedCount = analysis ? analysis.outlets.reduce((s, o) => s + (outletMap[o.value] ? o.count : 0), 0) : 0;
  const unmapped = analysis ? analysis.totalRows - mappedCount : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto p-4" style={{ background: "rgba(0,36,42,.45)" }} onClick={() => !busy && onClose()}>
      <div className="my-6 w-full max-w-xl rounded-2xl bg-white p-5 sm:p-6" style={{ boxShadow: "0 24px 60px -12px rgba(0,36,42,.6)" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold text-ink"><FileSpreadsheet size={20} /> Import rencana dari Excel</h3>
          <button type="button" onClick={() => !busy && onClose()} className="rounded-lg p-1 hover:bg-[rgba(0,60,68,.06)]"><X size={20} /></button>
        </div>

        {/* Indikator langkah */}
        <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold">
          {[["upload", "1. Unggah"], ["map", "2. Cek mapping"], ["done", "3. Selesai"]].map(([k, lbl], i) => {
            const active = (result && !result.error && k === "done") || (!result?.error && step === k) || (result?.error && step === k);
            return (
              <span key={k} className="flex items-center gap-2">
                {i > 0 && <ArrowRight size={12} className="text-[var(--ink-soft)]" />}
                <span style={{ color: active ? "var(--teal-900)" : "var(--ink-soft)" }}>{lbl}</span>
              </span>
            );
          })}
        </div>

        {result && !result.error ? (
          <ResultView accounts={accounts} result={result} onClose={onClose} reset={reset} />
        ) : step === "upload" ? (
          <UploadStep file={file} setFile={setFile} busy={busy} error={result?.error} onClose={onClose} onAnalyze={() => onAnalyze(file)} />
        ) : (
          <MapStep
            accounts={accounts} accountId={accountId} analysis={analysis} outletMap={outletMap} setOutletMap={setOutletMap}
            busy={busy} error={result?.error} mappedCount={mappedCount} unmapped={unmapped}
            onBack={() => setStep("upload")} onImport={onImport} onSheet={(name) => onAnalyze(file, name)}
          />
        )}
      </div>
    </div>
  );
}

// Langkah 1: unggah file + unduh template.
function UploadStep({ file, setFile, busy, error, onClose, onAnalyze }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
        Unggah file Excel berisi rencana. Bila file memuat <b>banyak cabang</b>, tambahkan kolom <b>Outlet</b> — nanti tiap Outlet dipetakan ke cabang di langkah berikutnya. Import bersifat <b>menambah</b> (tidak menghapus); baris Headline+Tanggal yang sudah ada dilewati.
      </p>
      <a href="/api/content-plan/template" className="inline-flex w-fit items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold" style={{ border: "1px solid rgba(0,60,68,.2)", color: "var(--teal-900)" }}>
        <Download size={16} /> Unduh template Excel
      </a>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-ink">File Excel (.xlsx)</span>
        <input type="file" accept=".xlsx" disabled={busy} onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[rgba(0,102,116,.1)] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[var(--teal-900)]" />
        {file && <span className="text-[11px]" style={{ color: "var(--ink-soft)" }}>Dipilih: {file.name}</span>}
      </label>
      {error && <div className="rounded-xl p-3 text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c" }}><b>Gagal:</b> {error}</div>}
      <div className="mt-1 flex items-center justify-end gap-2">
        <button type="button" onClick={onClose} disabled={busy} className="rounded-xl px-4 py-2 text-sm font-semibold" style={{ border: "1px solid rgba(0,60,68,.2)", color: "var(--ink)" }}>Batal</button>
        <button type="button" onClick={onAnalyze} disabled={busy || !file} className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "linear-gradient(180deg,#0a8291,#006674)" }}>
          {busy ? "Menganalisa…" : "Analisa file"} <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

// Langkah 2: pratinjau + peta Outlet -> cabang.
function MapStep({ accounts, accountId, analysis, outletMap, setOutletMap, busy, error, mappedCount, unmapped, onBack, onImport, onSheet }) {
  if (!analysis) return null;
  const setOne = (value, id) => setOutletMap({ ...outletMap, [value]: id });
  return (
    <div className="flex flex-col gap-3">
      {/* Sheet + ringkasan */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <label className="flex items-center gap-2">
          <span className="font-semibold text-ink">Sheet:</span>
          <select value={analysis.sheetUsed} disabled={busy} onChange={(e) => onSheet(e.target.value)} className="input-3d !min-h-0 !py-1 !px-2 text-sm">
            {analysis.sheetNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <span className="text-[12px]" style={{ color: "var(--ink-soft)" }}>
          <b className="text-ink">{analysis.totalRows}</b> baris{analysis.skippedEmpty > 0 ? ` · ${analysis.skippedEmpty} kosong diabaikan` : ""}
        </span>
      </div>

      {/* Peta Outlet -> cabang */}
      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink"><Store size={15} /> Petakan Outlet ke cabang</div>
        <div className="overflow-hidden rounded-xl" style={{ border: "1px solid rgba(0,60,68,.12)" }}>
          <table className="w-full text-left text-sm">
            <thead style={{ background: "rgba(0,102,116,.07)" }}>
              <tr>
                <th className="px-3 py-1.5 text-[11px] font-semibold text-ink">Outlet (di file)</th>
                <th className="px-2 py-1.5 text-[11px] font-semibold text-ink">Baris</th>
                <th className="px-3 py-1.5 text-[11px] font-semibold text-ink">→ Cabang tujuan</th>
              </tr>
            </thead>
            <tbody>
              {analysis.outlets.map((o) => (
                <tr key={o.value || "__blank__"} className="border-t" style={{ borderColor: "rgba(0,60,68,.08)" }}>
                  <td className="px-3 py-1.5">
                    {o.value ? <span className="font-medium text-ink">{o.value}</span> : <span className="italic" style={{ color: "var(--ink-soft)" }}>(tanpa outlet)</span>}
                  </td>
                  <td className="px-2 py-1.5 text-[12px]" style={{ color: "var(--ink-soft)" }}>{o.count}</td>
                  <td className="px-3 py-1.5">
                    <select value={outletMap[o.value] || ""} disabled={busy} onChange={(e) => setOne(o.value, e.target.value)} className="input-3d !min-h-0 !py-1 !px-2 text-[13px]" style={{ width: "100%" }}>
                      <option value="">— lewati —</option>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.nama_cabang}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {unmapped > 0 && (
          <p className="mt-1.5 text-[12px]" style={{ color: "#b45309" }}>⚠ {unmapped} baris akan <b>dilewati</b> karena Outlet-nya belum dipetakan.</p>
        )}
      </div>

      {/* Pratinjau baris */}
      {analysis.sample?.length > 0 && (
        <details className="rounded-xl" style={{ border: "1px solid rgba(0,60,68,.12)" }}>
          <summary className="cursor-pointer px-3 py-2 text-[12px] font-semibold text-ink">Pratinjau {analysis.sample.length} baris pertama</summary>
          <div className="max-h-40 overflow-auto border-t px-3 py-2 text-[11px]" style={{ borderColor: "rgba(0,60,68,.08)", color: "var(--ink-soft)" }}>
            {analysis.sample.map((s, i) => (
              <div key={i} className="flex items-center gap-2 py-0.5">
                <span className="w-14 shrink-0">{fmtDateShort(s.post_date)}</span>
                <span className="min-w-0 flex-1 truncate text-ink" title={s.headline || ""}>{s.headline || "—"}</span>
                <span className="shrink-0" style={{ color: outletMap[s.outlet || ""] ? "#166534" : "#b45309" }}>
                  {outletMap[s.outlet || ""] ? `→ ${branchLabel(accounts, outletMap[s.outlet || ""])}` : "→ dilewati"}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {error && <div className="rounded-xl p-3 text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c" }}><b>Gagal:</b> {error}</div>}

      <div className="mt-1 flex items-center justify-between gap-2">
        <button type="button" onClick={onBack} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold" style={{ border: "1px solid rgba(0,60,68,.2)", color: "var(--ink)" }}>
          <ArrowLeft size={16} /> Kembali
        </button>
        <button type="button" onClick={onImport} disabled={busy || mappedCount === 0} className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "linear-gradient(180deg,#0a8291,#006674)" }}>
          <UploadCloud size={16} /> {busy ? "Mengimpor…" : `Import ${mappedCount} baris`}
        </button>
      </div>
    </div>
  );
}

// Langkah 3: ringkasan hasil.
function ResultView({ accounts, result, onClose, reset }) {
  return (
    <div className="rounded-xl p-4 text-sm" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534" }}>
      <p className="text-base font-semibold">✅ Berhasil import {result.inserted} rencana.</p>
      {result.byBranch?.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {result.byBranch.map((b) => (
            <li key={b.accountId} className="flex items-center justify-between gap-3 text-[13px]">
              <span>{branchLabel(accounts, b.accountId)}</span>
              <span className="font-semibold">{b.count} baris</span>
            </li>
          ))}
        </ul>
      )}
      {(result.skippedDup > 0 || result.skippedEmpty > 0 || result.skippedUnmapped > 0) && (
        <p className="mt-2 text-[12px]" style={{ color: "#3f6212" }}>
          {result.skippedDup > 0 && `${result.skippedDup} duplikat dilewati. `}
          {result.skippedUnmapped > 0 && `${result.skippedUnmapped} tanpa cabang dilewati. `}
          {result.skippedEmpty > 0 && `${result.skippedEmpty} baris kosong diabaikan.`}
        </p>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={reset} className="rounded-xl px-3 py-1.5 text-sm font-semibold" style={{ border: "1px solid rgba(0,60,68,.2)", color: "var(--ink)" }}>Import lagi</button>
        <button type="button" onClick={onClose} className="rounded-xl px-3 py-1.5 text-sm font-semibold text-white" style={{ background: "linear-gradient(180deg,#0a8291,#006674)" }}>Selesai</button>
      </div>
    </div>
  );
}
