import { requireUser } from "@/lib/auth/session";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { NavLinks } from "@/components/nav-links";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const links = [
    { href: "/zemljevid", label: "Zemljevid", show: true },
    { href: "/vozila", label: "Vozila", show: user.canManageVehicles || user.canManagePlatform },
    { href: "/skupine", label: "Skupine", show: user.canManageVehicles || user.canManagePlatform },
    { href: "/rezervacije", label: "Rezervacija vozila", show: user.canManageVehicles || user.canManagePlatform },
    { href: "/vozniki", label: "Vozniki", show: true },
    { href: "/porocila", label: "Poročila", show: user.canViewReports },
    { href: "/potni-nalogi", label: "Potni nalogi", show: user.canManageUsers },
    { href: "/tacho", label: "Tacho", show: user.canManageUsers },
    { href: "/uporabniki", label: "Uporabniki", show: user.canManageUsers },
    { href: "/admin/naprave", label: "Naprave", show: user.canManagePlatform },
    { href: "/admin/najemniki", label: "Podjetja", show: user.canManagePlatform },
    { href: "/admin/paketi", label: "Paketi", show: user.canManagePlatform },
    { href: "/revizijska-sled", label: "Revizijska sled", show: user.canManagePlatform },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="border-b border-green-200 bg-green-100 dark:border-green-900 dark:bg-green-950">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-gray-900 dark:text-gray-100">Sledenje</span>
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-gray-700 dark:text-gray-300 sm:inline">{user.fullName}</span>
              <ThemeToggle />
              <LogoutButton />
            </div>
          </div>
          <NavLinks links={links.filter((l) => l.show)} />
        </div>
      </header>
      <main className="px-6 py-6">{children}</main>
    </div>
  );
}
