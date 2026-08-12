"use client";

import { useMemo, useState } from "react";
import { ScheduleToggle } from "./schedule-toggle";

export type VehicleScheduleRow = {
  id: string;
  plate: string;
  tachoScheduleEnabled: boolean;
};

type SortDir = "asc" | "desc";
type ColumnKey = "plate";

function sortValue(row: VehicleScheduleRow, key: ColumnKey): string | number {
  switch (key) {
    case "plate":
      return row.plate;
  }
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "sl-SI", { numeric: true });
}

export function VehicleScheduleTable({
  vehicles,
  action,
}: {
  vehicles: VehicleScheduleRow[];
  action: (id: string, checked: boolean) => Promise<void>;
}) {
  const [sort, setSort] = useState<{ key: ColumnKey; dir: SortDir } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return vehicles;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...vehicles].sort((a, b) => factor * compare(sortValue(a, sort.key), sortValue(b, sort.key)));
  }, [vehicles, sort]);

  function handleSort(key: ColumnKey) {
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function sortIndicator(key: ColumnKey) {
    if (sort?.key !== key) return "";
    return sort.dir === "asc" ? " ▲" : " ▼";
  }

  return (
    <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">V urniku</th>
            <th
              onClick={() => handleSort("plate")}
              className="cursor-pointer select-none px-3 py-2 text-left text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Vozilo{sortIndicator("plate")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {sorted.map((v) => (
            <tr key={v.id}>
              <td className="px-3 py-2">
                <ScheduleToggle id={v.id} checked={v.tachoScheduleEnabled} action={action} />
              </td>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{v.plate}</td>
            </tr>
          ))}
          {vehicles.length === 0 && (
            <tr>
              <td colSpan={2} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Ni vozil.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
