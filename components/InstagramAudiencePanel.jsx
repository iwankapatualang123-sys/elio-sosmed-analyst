// File: components/InstagramAudiencePanel.jsx
// Panel "Pemirsa" Instagram (demografi) — server component, dirender di Dashboard
// Instagram. Menampilkan snapshot audience terbaru: total follower, gender, sebaran
// usia (perempuan vs laki-laki), kota & negara populer. Input dari halaman Upload.

import { deleteInstagramAudience } from "@/app/upload/actions";

const fmt = (n) => Number(n || 0).toLocaleString("id-ID");

function GenderBar({ label, pct, color }) {
  if (pct == null) return null;
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="w-16 text-[11px]" style={{ color: "var(--ink-soft)" }}>{label}</span>
      <span className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: "#f0f1f6" }}>
        <span className="block h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      </span>
      <span className="w-12 text-right text-[11px] font-bold text-ink">{pct}%</span>
    </div>
  );
}

export default function InstagramAudiencePanel({ audience, history = [], accountId = null, editable = false }) {
  if (!audience) return null;
  const age = Array.isArray(audience.age_json) ? audience.age_json : [];
  const cities = Array.isArray(audience.cities_json) ? audience.cities_json : [];
  const countries = Array.isArray(audience.countries_json) ? audience.countries_json : [];
  const female = audience.female_pct;
  const male = audience.male_pct;
  const ageMax = Math.max(1, ...age.flatMap((a) => [Number(a.female) || 0, Number(a.male) || 0]));

  return (
    <section className="card-3d p-4 sm:p-5">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-ink">👥 Pemirsa Instagram (demografi)</h3>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(193,53,132,.1)", color: "#a12472" }}>
          snapshot {String(audience.snapshot_date).slice(0, 10)}
        </span>
        {audience.followers != null && (
          <span className="ml-auto text-sm">
            <b className="text-ink">{fmt(audience.followers)}</b> <span style={{ color: "var(--ink-soft)" }}>total pengikut</span>
          </span>
        )}
      </div>

      <div className="mt-3 grid gap-5 lg:grid-cols-2">
        {/* Gender + Usia */}
        <div>
          {(female != null || male != null) && (
            <>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Gender</p>
              <GenderBar label="Perempuan" pct={female} color="#c13584" />
              <GenderBar label="Laki-laki" pct={male} color="#5b63eb" />
            </>
          )}
          {age.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Usia (P / L)</p>
              <div className="flex flex-col gap-1.5">
                {age.map((a) => (
                  <div key={a.bracket} className="flex items-center gap-2">
                    <span className="w-12 text-[11px]" style={{ color: "var(--ink-soft)" }}>{a.bracket}</span>
                    <div className="flex flex-1 flex-col gap-0.5">
                      <span className="h-2 overflow-hidden rounded-full" style={{ background: "#f7edf3" }}>
                        <span className="block h-full rounded-full" style={{ width: `${((Number(a.female) || 0) / ageMax) * 100}%`, background: "#c13584" }} />
                      </span>
                      <span className="h-2 overflow-hidden rounded-full" style={{ background: "#eef0fe" }}>
                        <span className="block h-full rounded-full" style={{ width: `${((Number(a.male) || 0) / ageMax) * 100}%`, background: "#5b63eb" }} />
                      </span>
                    </div>
                    <span className="w-16 text-right text-[10px]" style={{ color: "var(--ink-soft)" }}>
                      {a.female != null ? `${a.female}%` : "—"} / {a.male != null ? `${a.male}%` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Kota + Negara */}
        <div>
          {cities.length > 0 && (() => {
            // cities_json bisa string[] (data lama) atau {name,pct}[] (data baru).
            const rows = cities.slice(0, 8).map((c) => (typeof c === "string" ? { name: c, pct: null } : { name: c.name, pct: c.pct }));
            const hasPct = rows.some((r) => r.pct != null);
            return (
              <div className="mb-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Kota populer</p>
                {hasPct ? (
                  <div className="flex flex-col gap-1.5">
                    {rows.map((c, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-20 truncate text-[11px]" style={{ color: "var(--ink-soft)" }} title={c.name}>{c.name}</span>
                        <span className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: "#f0f1f6" }}>
                          <span className="block h-full rounded-full" style={{ width: `${Math.min(100, Number(c.pct) || 0)}%`, background: "#5b63eb" }} />
                        </span>
                        <span className="w-10 text-right text-[11px] font-bold text-ink">{c.pct == null ? "—" : `${c.pct}%`}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ol className="flex flex-col gap-1 text-[12.5px]">
                    {rows.map((c, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="w-4 text-right text-[10px] font-bold" style={{ color: "var(--ink-soft)" }}>{i + 1}</span>
                        <span className="truncate text-ink">{c.name}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            );
          })()}
          {countries.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Negara populer</p>
              <div className="flex flex-col gap-1.5">
                {countries.slice(0, 6).map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-20 truncate text-[11px]" style={{ color: "var(--ink-soft)" }} title={c.name}>{c.name}</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: "#f0f1f6" }}>
                      <span className="block h-full rounded-full" style={{ width: `${Math.min(100, Number(c.pct) || 0)}%`, background: "#12b76a" }} />
                    </span>
                    <span className="w-12 text-right text-[11px] font-bold text-ink">{c.pct == null ? "—" : `${c.pct}%`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Riwayat snapshot Pemirsa (+ hapus untuk koreksi tanggal salah) */}
      {history.length > 0 && (
        <div className="mt-4 border-t pt-3" style={{ borderColor: "rgba(16,24,40,.1)" }}>
          <p className="mb-1.5 text-[11px] font-semibold" style={{ color: "var(--ink-soft)" }}>Riwayat snapshot ({history.length})</p>
          <ul className="flex flex-col gap-1 text-[12px]">
            {history.map((h) => {
              const d = String(h.snapshot_date).slice(0, 10);
              const isLatest = d === String(audience.snapshot_date).slice(0, 10);
              return (
                <li key={d} className="flex items-center gap-2">
                  <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: isLatest ? "rgba(193,53,132,.1)" : "rgba(16,24,40,.05)", color: isLatest ? "#a12472" : "var(--ink-soft)" }}>{d}{isLatest ? " · terbaru" : ""}</span>
                  <span className="text-ink">{h.followers != null ? `${fmt(h.followers)} pengikut` : "—"}</span>
                  {(h.female_pct != null || h.male_pct != null) && (
                    <span style={{ color: "var(--ink-soft)" }}>· P {h.female_pct ?? "—"}% / L {h.male_pct ?? "—"}%</span>
                  )}
                  {editable && accountId && (
                    <form action={deleteInstagramAudience} className="ml-auto">
                      <input type="hidden" name="accountId" value={accountId} />
                      <input type="hidden" name="snapshot_date" value={d} />
                      <button type="submit" className="text-[11px] font-semibold text-red-500 hover:text-red-700" aria-label={`Hapus snapshot ${d}`}>Hapus</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-1.5 text-[10px]" style={{ color: "var(--ink-soft)" }}>Untuk memperbaiki, input ulang di tanggal yang sama (menimpa) atau hapus lalu input ulang. Menghapus di sini tidak mengubah angka follower di grafik (dikelola terpisah di Upload).</p>
        </div>
      )}
    </section>
  );
}
