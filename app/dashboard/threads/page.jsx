// File: app/dashboard/threads/page.jsx
// Route Dashboard ▸ Threads — detail per outlet dgn tab Threads terbuka.
import OutletDetail from "@/components/OutletDetail";

export default function Page({ searchParams }) {
  return <OutletDetail searchParams={searchParams} defaultPlatform="threads" />;
}
