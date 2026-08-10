"use client";

import { useTransition } from "react";

export function SelectAllToggle({
  tenantId,
  action,
  label,
}: {
  tenantId: string;
  action: (tenantId: string, checked: boolean) => Promise<void>;
  label: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
      <input
        type="checkbox"
        disabled={pending}
        onChange={(e) => startTransition(() => action(tenantId, e.target.checked))}
      />
      {label}
    </label>
  );
}
