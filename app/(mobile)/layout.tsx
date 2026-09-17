import { requireUser } from "@/lib/auth/session";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex h-[100dvh] flex-col bg-gray-50 dark:bg-gray-900">
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      <MobileBottomNav canManageVehicles={user.canManageVehicles || user.canManagePlatform} />
    </div>
  );
}
