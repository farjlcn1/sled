import { requireUser } from "@/lib/auth/session";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  await requireUser();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="flex items-center justify-between gap-3 border-b border-green-200 bg-green-100 px-3 py-2 dark:border-green-900 dark:bg-green-950">
        <span className="font-semibold text-gray-900 dark:text-gray-100">Sledenje</span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LogoutButton />
        </div>
      </header>
      <main className="p-3">{children}</main>
    </div>
  );
}
