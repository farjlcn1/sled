"use client";

import { useEffect, useState } from "react";
import {
  addNewAccount,
  isAccountSwitchAvailable,
  listSavedAccounts,
  removeAccount,
  saveCurrentAccount,
  switchToAccount,
  type SavedAccount,
} from "@/lib/capacitor/account-switch";

export function MobileAccountSwitcher({ currentEmail }: { currentEmail: string }) {
  const [available, setAvailable] = useState(false);
  const [accounts, setAccounts] = useState<SavedAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  // isAccountSwitchAvailable() je vedno false med SSR (ni Capacitor bridga na strežniku) -- v
  // useEffect, ne v render telesu, da se izognemo hydration mismatchu.
  useEffect(() => {
    if (!isAccountSwitchAvailable()) return;
    setAvailable(true);
    let cancelled = false;
    (async () => {
      try {
        await saveCurrentAccount(currentEmail);
        const list = await listSavedAccounts();
        if (!cancelled) setAccounts(list);
      } catch {
        if (!cancelled) setError("Računov ni bilo mogoče naložiti.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentEmail]);

  if (!available) return null;

  async function handleSwitch(id: string) {
    setPendingId(id);
    try {
      await switchToAccount(id);
      window.location.assign("/mobilna");
    } catch {
      setError("Preklop ni uspel.");
      setPendingId(null);
    }
  }

  function handleRemove(id: string) {
    if (!window.confirm("Odstrani ta shranjeni račun?")) return;
    removeAccount(id).then(() => setAccounts((prev) => prev?.filter((a) => a.id !== id) ?? null));
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {accounts === null && <p className="text-sm text-gray-500 dark:text-gray-400">Nalagam …</p>}
      {accounts?.map((a) => {
        const isCurrent = a.label.toLowerCase() === currentEmail.toLowerCase();
        return (
          <div
            key={a.id}
            className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
          >
            <span className="truncate text-sm text-gray-900 dark:text-gray-100">
              {a.label}
              {isCurrent && <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">(trenutni)</span>}
            </span>
            {!isCurrent && (
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => handleSwitch(a.id)}
                  disabled={pendingId === a.id}
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Preklopi
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(a.id)}
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Odstrani
                </button>
              </div>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => addNewAccount()}
        className="rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        + Dodaj račun
      </button>
    </div>
  );
}
