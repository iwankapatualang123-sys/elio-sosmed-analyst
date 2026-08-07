// File: components/InstagramAudiencePanel.jsx
// Panel "Pemirsa" Instagram (demografi) — server component, dirender di Dashboard
// Instagram. Menampilkan snapshot audience terbaru: total follower, gender, sebaran
// usia (perempuan vs laki-laki), kota & negara populer. Input dari halaman Upload.

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

export default function InstagramAudiencePanel({ audience }) {
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
          {cities.length > 0 && (
            <div className="mb-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Kota populer</p>
              <ol className="flex flex-col gap-1 text-[12.5px]">
                {cities.slice(0, 8).map((c, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-4 text-right text-[10px] font-bold" style={{ color: "var(--ink-soft)" }}>{i + 1}</span>
                    <span className="truncate text-ink">{c}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
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
    </section>
  );
}
