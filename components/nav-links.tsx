"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <nav className="mt-2 flex flex-wrap gap-x-1 gap-y-1">
      {links.map((l) => {
        const isActive = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={
              isActive
                ? "rounded-md bg-white px-2 py-1.5 text-base font-semibold text-gray-900 shadow-sm sm:px-2 sm:py-1 sm:text-sm"
                : "rounded-md px-2 py-1.5 text-base text-gray-700 hover:bg-white/60 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-white/10 dark:hover:text-white sm:px-2 sm:py-1 sm:text-sm"
            }
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
