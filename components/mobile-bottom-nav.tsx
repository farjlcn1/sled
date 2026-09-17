"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function HomeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <path d="M3 9.5 10 4l7 5.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 8.5V16a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 17v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <path d="M10 18s6-5.2 6-9.8A6 6 0 1 0 4 8.2C4 12.8 10 18 10 18Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="8.2" r="2" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <path
        d="M13.5 4.5a3 3 0 0 0-3.9 3.9L4 14v2h2l5.6-5.6a3 3 0 0 0 3.9-3.9l-2.1 2.1-1.9-1.9Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" />
    </svg>
  );
}

const ALL_TABS = [
  { href: "/mobilna", label: "Domov", Icon: HomeIcon, requiresVehicleManage: false },
  { href: "/mobilna/karta", label: "Karta", Icon: MapPinIcon, requiresVehicleManage: false },
  { href: "/mobilna/vozila", label: "Vozila", Icon: WrenchIcon, requiresVehicleManage: true },
  { href: "/mobilna/menu", label: "Menu", Icon: MenuIcon, requiresVehicleManage: false },
];

export function MobileBottomNav({ canManageVehicles }: { canManageVehicles: boolean }) {
  const pathname = usePathname();
  const tabs = ALL_TABS.filter((t) => !t.requiresVehicleManage || canManageVehicles);

  return (
    <nav className="flex shrink-0 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-gray-700 dark:bg-gray-800">
      {tabs.map(({ href, label, Icon }) => {
        // Domov (koren "/mobilna") namerno samo natančno ujemanje -- sicer bi zaradi
        // startsWith("/mobilna/") svetil hkrati z vsakim drugim zavihkom. Ostali zavihki (npr.
        // Vozila -> /mobilna/vozila/[id]) smejo ujemati tudi svoje podstrani.
        const isActive = pathname === href || (href !== "/mobilna" && pathname.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] ${
              isActive
                ? "text-green-700 dark:text-green-400"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            <Icon />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
