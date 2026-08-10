"use client";

import { useTransition } from "react";
import { toggleUserActive } from "./actions";

export function ToggleActiveButton({ userId, isActive }: { userId: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => toggleUserActive(userId, !isActive))}
      className="text-sm text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
    >
      {isActive ? "Onemogoči" : "Omogoči"}
    </button>
  );
}
