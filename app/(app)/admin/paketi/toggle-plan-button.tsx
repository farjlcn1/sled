"use client";

import { useTransition } from "react";
import { togglePlanActive } from "./actions";

export function TogglePlanButton({ id, isActive }: { id: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => togglePlanActive(id, !isActive))}
      className="text-sm text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
    >
      {isActive ? "Onemogoči" : "Omogoči"}
    </button>
  );
}
