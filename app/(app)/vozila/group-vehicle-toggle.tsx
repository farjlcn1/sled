"use client";

import { useTransition } from "react";
import { toggleGroupVehicle } from "./actions";

export function GroupVehicleToggle({
  groupId,
  vehicleId,
  inGroup,
}: {
  groupId: string;
  vehicleId: string;
  inGroup: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300">
      <input
        type="checkbox"
        defaultChecked={inGroup}
        disabled={pending}
        onChange={(e) => startTransition(() => toggleGroupVehicle(groupId, vehicleId, e.target.checked))}
      />
    </label>
  );
}
