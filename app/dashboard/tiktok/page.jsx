// File: app/dashboard/tiktok/page.jsx
// Route Dashboard ▸ TikTok — detail per outlet dgn tab TikTok terbuka.
import OutletDetail from "@/components/OutletDetail";

export default function Page({ searchParams }) {
  return <OutletDetail searchParams={searchParams} defaultPlatform="tiktok" />;
}
