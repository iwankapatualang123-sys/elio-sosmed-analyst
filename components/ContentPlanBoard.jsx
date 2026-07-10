// File: components/ContentPlanBoard.jsx
// Papan Rencana Konten (client): tabel editable meniru sheet Excel "Content Plan".
// Kolom: No, Post, Status (otomatis), PIC, Headline/Hook, Pillar, Goals, Type, ACC.
// Tambah/edit lewat modal; ACC toggle cepat; hapus dgn konfirmasi. Status Uploaded/
// WIP/Draf dihitung di server (lib/tiktok/content-plan) & dioper via prop `status`.

"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Pencil, Trash2, X, ExternalLink, CheckCircle2, CircleDashed } from "lucide-react";
import { createPlan, updatePlan, deletePlan, toggleAcc, setPostedUrl } from "@/app/content-plan/actions";

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

// Badge warna status verifikasi.
function StatusBadge({ status }) {
  const map = {
    Verified: { bg: "rgba(22,101,52,.1)", fg: "#166534", label: "Verified", Icon: CheckCircle2 },
    "Not verified": { bg: "rgba(0,60,68,.08)", fg: "var(--ink-soft)", label: "Not verified", Icon: CircleDashed },
  };
  const s = map[status] || map["Not verified"];
  const Icon = s.Icon;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: s.bg, color: s.fg }}>
      <Icon size={12} />
      {s.label}
    </span>
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
};

export default function ContentPlanBoard({ accountId, accounts = [], plans = [], options = {}, pics = [] }) {
  const [editing, setEditing] = useState(null); // null | {row} | 'new'
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
  function saveLink(row, value) {
    const next = value.trim();
    if (next === String(row.posted_url || "").trim()) return;
    const fd = new FormData();
    fd.set("id", String(row.id));
    fd.set("posted_url", next);
    startTransition(() => setPostedUrl(fd));
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
          {plans.length} baris rencana. Tempel <b>Link tayang</b> setelah konten di-upload — status jadi <b>Verified</b> saat link cocok dengan data report TikTok.
        </p>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-white"
          style={{ background: "linear-gradient(180deg,#0a8291,#006674)", boxShadow: "0 6px 14px -4px rgba(0,60,68,.5)" }}
        >
          <Plus size={16} /> Tambah rencana
        </button>
      </div>

      <div className="overflow-auto rounded-xl" style={{ maxHeight: 620, border: "1px solid rgba(0,60,68,.1)" }}>
        <table className="w-full text-left text-sm" style={{ tableLayout: "fixed" }}>
          {/* Lebar kolom tetap: Post/Status/PIC dipersempit, Headline diperlebar
              supaya jadi fokus utama tabel — bukan mengikuti isi teks otomatis. */}
          <colgroup>
            <col style={{ width: 36 }} />
            <col style={{ width: 52 }} />
            <col style={{ width: 96 }} />
            <col style={{ width: 128 }} />
            <col style={{ width: 50 }} />
            <col style={{ width: 330 }} />
            <col style={{ width: 68 }} />
            <col style={{ width: 108 }} />
            <col style={{ width: 88 }} />
            <col style={{ width: 68 }} />
            <col style={{ width: 44 }} />
            <col style={{ width: 108 }} />
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
              plans.map((p, i) => (
                <tr key={p.id} className="border-t align-middle" style={{ borderColor: "rgba(0,60,68,.08)" }}>
                  <td className="px-1.5 py-1.5 text-[10px]" style={{ color: "var(--ink-soft)" }}>{p.seq || i + 1}</td>
                  <td className="overflow-hidden text-ellipsis whitespace-nowrap px-1.5 py-1.5 text-[10px]" title={fmtDateFull(p.post_date)}>{fmtDate(p.post_date)}</td>
                  <td className="overflow-hidden px-1.5 py-1.5">
                    <StatusBadge status={p.status} />
                    {p.match && (
                      <div className="mt-1 max-w-[86px] truncate text-[9px]" style={{ color: "#166534" }} title={p.match.video_title}>
                        ✓ {p.match.video_title}
                      </div>
                    )}
                    {!p.match && p.hint && (
                      <div className="mt-1 max-w-[86px] truncate text-[9px]" style={{ color: "var(--ink-soft)" }} title={`Mungkin sudah tayang — tempel linknya untuk verifikasi: ${p.hint.video_title}`}>
                        💡 {p.hint.video_title}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="url"
                      defaultValue={p.posted_url || ""}
                      onBlur={(e) => saveLink(p, e.target.value)}
                      placeholder="tempel link…"
                      disabled={pending}
                      className="input-3d !min-h-0 !py-1 !px-2 text-[11px]"
                      style={{ width: "100%" }}
                      title="Tempel link konten yang sudah tayang. Status jadi Verified bila cocok data report."
                    />
                    {p.posted_url && (
                      <a href={p.posted_url} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-[9px] font-semibold" style={{ color: "var(--teal-900)" }}>
                        <ExternalLink size={9} /> buka
                      </a>
                    )}
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
                      <button type="button" onClick={() => removeRow(p.id)} className="rounded-lg p-1 hover:bg-red-50" title="Hapus">
                        <Trash2 size={14} className="text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
                {editing === "new" ? (
                  <Field label="Cabang" hint="Rencana ini akan tersimpan untuk cabang yang dipilih di sini.">
                    <select name="accountId" defaultValue={accountId} className="input-3d">
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.nama_cabang}{a.tiktok_username ? ` (@${a.tiktok_username})` : ""}</option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <>
                    <input type="hidden" name="accountId" value={accountId} />
                    <div className="text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
                      Cabang: <span className="font-semibold text-ink">{accounts.find((a) => a.id === accountId)?.nama_cabang || "—"}</span>
                    </div>
                  </>
                )}
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
                <Field label="Link konten tayang (diisi tim setelah upload)" hint="Tempel link TikTok konten yang sudah tayang. Status jadi Verified bila cocok dengan data report yang di-upload.">
                  <input name="posted_url" type="url" defaultValue={draft.posted_url || ""} placeholder="https://www.tiktok.com/@.../video/..." className="input-3d" />
                </Field>
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
              <Field label="Status override (opsional)" hint="Kosongkan agar status otomatis dari data.">
                <select name="status_override" defaultValue={draft.status_override || ""} className="input-3d">
                  <option value="">— Otomatis —</option>
                  <option value="Verified">Verified</option>
                  <option value="Not verified">Not verified</option>
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

// Tombol simpan dgn indikator pending (useFormStatus butuh berada di dalam <form>).
function SubmitButton({ isNew }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "linear-gradient(180deg,#0a8291,#006674)" }}>
      {pending ? "Menyimpan…" : isNew ? "Tambah" : "Simpan"}
    </button>
  );
}
