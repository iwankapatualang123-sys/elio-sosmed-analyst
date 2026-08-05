// File: app/dashboard/instagram/page.jsx
// Route Dashboard ▸ Instagram — detail per outlet dgn tab Instagram terbuka.
import OutletDetail from "@/components/OutletDetail";

export default function Page({ searchParams }) {
  return <OutletDetail searchParams={searchParams} defaultPlatform="instagram" />;
}
