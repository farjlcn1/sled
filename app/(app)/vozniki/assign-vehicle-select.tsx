"use client";

import { useTransition } from "react";
import { assignDriverToVehicle } from "./actions";

export function AssignVehicleSelect({
  driverId,
  currentVehicleId,
  vehicles,
}: {
  driverId: string;
  currentVehicleId: string | null;
  vehicles: { id: string; plate: string }[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      defaultValue={currentVehicleId ?? ""}
      disabled={pending}
      onChange={(e) => startTransition(() => assignDriverToVehicle(driverId, e.target.value))}
      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
    >
      <option value="">— brez vozila —</option>
      {vehicles.map((v) => (
        <option key={v.id} value={v.id}>
          {v.plate}
        </option>
      ))}
    </select>
  );
}
