"use client";

import { useState, useTransition } from "react";
import { assignDeviceToTenant } from "./actions";

export function AssignTenantSelect({
  deviceId,
  currentTenantId,
  tenants,
}: {
  deviceId: string;
  currentTenantId: string | null;
  tenants: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <select
        defaultValue={currentTenantId ?? ""}
        disabled={pending}
        onChange={(e) => {
          setError(null);
          startTransition(async () => {
            try {
              await assignDeviceToTenant(deviceId, e.target.value);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Napaka.");
            }
          });
        }}
        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      >
        <option value="">— nedodeljeno —</option>
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
