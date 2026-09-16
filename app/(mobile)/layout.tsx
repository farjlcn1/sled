import { requireUser } from "@/lib/auth/session";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  await requireUser();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="p-3 pb-[calc(4rem+env(safe-area-inset-bottom))]">{children}</main>
      <MobileBottomNav />
    </div>
  );
}
