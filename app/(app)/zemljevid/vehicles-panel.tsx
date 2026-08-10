"use client";

import { useState } from "react";
import { VehicleMap, type HistoryRoute } from "@/components/vehicle-map";
import type { VehicleIcon } from "@/app/api/pozicije/route";
import { VehicleRow } from "./vehicle-row";

export type VehicleListItem = {
  id: string;
  plate: string;
  brandModel: string;
  driverName: string | null;
  icon: VehicleIcon;
  nextServiceDate: string | null;
};

export function VehiclesPanel({
  vehicles,
  selectedVehicleId,
  historyRoute,
}: {
  vehicles: VehicleListItem[];
  selectedVehicleId?: string;
  historyRoute?: HistoryRoute | null;
}) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());

  function toggleChecked(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allChecked = vehicles.length > 0 && vehicles.every((v) => checkedIds.has(v.id));

  function toggleAll() {
    setCheckedIds(allChecked ? new Set() : new Set(vehicles.map((v) => v.id)));
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
      <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="w-8 px-3 py-2">
                <div
                  onClick={toggleAll}
                  role="checkbox"
                  aria-checked={allChecked}
                  aria-label="Izberi vsa vozila na zemljevidu"
                  title="Izberi/odkljukaj vsa vozila"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleAll();
                    }
                  }}
                  className={
                    allChecked
                      ? "h-5 w-5 cursor-pointer rounded border border-green-500 bg-green-200 dark:border-green-500 dark:bg-green-800"
                      : "h-5 w-5 cursor-pointer rounded border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800"
                  }
                />
              </th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Vozila</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {vehicles.map((v) => (
              <VehicleRow
                key={v.id}
                vehicleId={v.id}
                plate={v.plate}
                brandModel={v.brandModel}
                driverName={v.driverName}
                nextServiceDate={v.nextServiceDate}
                isSelected={v.id === selectedVehicleId}
                checked={checkedIds.has(v.id)}
                onToggleChecked={() => toggleChecked(v.id)}
              />
            ))}
            {vehicles.length === 0 && (
              <tr>
                <td colSpan={2} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  Ni še vozil.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <VehicleMap visibleVehicleIds={checkedIds} historyRoute={historyRoute} />
    </div>
  );
}
