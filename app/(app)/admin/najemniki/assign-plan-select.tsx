"use client";

import { useState, useTransition } from "react";
import { assignPlanToTenant } from "../paketi/actions";

export function AssignPlanSelect({
  tenantId,
  currentPlanId,
  plans,
}: {
  tenantId: string;
  currentPlanId: string | null;
  plans: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <select
        defaultValue={currentPlanId ?? ""}
        disabled={pending}
        onChange={(e) => {
          setError(null);
          startTransition(async () => {
            try {
              await assignPlanToTenant(tenantId, e.target.value);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Napaka.");
            }
          });
        }}
        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      >
        <option value="">— brez paketa —</option>
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
