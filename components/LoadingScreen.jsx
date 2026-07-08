// File: components/LoadingScreen.jsx
// Skeleton/shimmer saat halaman memuat data (blueprint 22). Dipakai loading.jsx.

export default function LoadingScreen({ cards = 4 }) {
  return (
    <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <div className="skeleton" style={{ height: 60, borderRadius: 22 }} />
      <div className="skeleton" style={{ height: 40, width: 260 }} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 120, borderRadius: 28 }} />
        ))}
      </div>
      <div className="skeleton" style={{ height: 220, borderRadius: 28 }} />
    </main>
  );
}
