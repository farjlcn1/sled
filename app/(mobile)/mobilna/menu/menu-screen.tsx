"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/logout-button";
import { MobileAccountSwitcher } from "@/components/mobile-account-switcher";

export function MenuScreen({
  userFullName,
  currentEmail,
  appVersion,
}: {
  userFullName: string;
  currentEmail: string;
  appVersion: string;
}) {
  return (
    <div className="flex flex-col gap-6 p-3">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Menu</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Prijavljen kot {userFullName}</p>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <LogoutButton />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Računi</h2>
        <MobileAccountSwitcher currentEmail={currentEmail} />
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-500">Različica {appVersion}</p>
    </div>
  );
}
