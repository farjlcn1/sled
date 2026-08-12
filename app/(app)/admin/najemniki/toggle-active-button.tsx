"use client";

import { useTransition } from "react";
import { toggleTenantActive } from "./actions";

export function ToggleActiveButton({ tenantId, isActive }: { tenantId: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => toggleTenantActive(tenantId, !isActive))}
      className="text-sm text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
    >
      {isActive ? "Onemogoči" : "Omogoči"}
    </button>
  );
}
