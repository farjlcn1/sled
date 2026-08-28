"use client";

import { useMemo, useState } from "react";
import { ScheduleToggle } from "./schedule-toggle";
import { SelectAllToggle } from "./select-all-toggle";
import { CalendarIcon, FileIcon } from "./icons";

export type VehicleScheduleRow = {
  id: string;
  plate: string;
  tachoScheduleEnabled: boolean;
  lastFile: { id: string; downloadedAt: Date } | null;
};

type SortDir = "asc" | "desc";
type ColumnKey = "plate";

function fmtDate(d: Date): string {
  return d.toLocaleDateString("sl-SI", { day: "2-digit", month: "2-digit", year: "numeric" });
}

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

// EU zahteva prenos podatkov iz enote v vozilu najkasneje vsakih 90 dni -- za vozila to (za
// razliko od voznikove kartice) ni nastavljivo po vozilu, zato je ikona tu enaka za vse vrstice.
const VEHICLE_PERIOD_DAYS = 90;

export function VehicleScheduleTable({
  vehicles,
  action,
  tenantId,
  selectAllAction,
}: {
  vehicles: VehicleScheduleRow[];
  action: (id: string, checked: boolean) => Promise<void>;
  tenantId: string;
  selectAllAction: (tenantId: string, checked: boolean) => Promise<void>;
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

  const allChecked = vehicles.length > 0 && vehicles.every((v) => v.tachoScheduleEnabled);

  return (
    <div className="max-w-2xl overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="w-10 px-3 py-2">
              <SelectAllToggle tenantId={tenantId} action={selectAllAction} allChecked={allChecked} title="Izberi vsa vozila" />
            </th>
            <th
              onClick={() => handleSort("plate")}
              className="cursor-pointer select-none px-3 py-2 text-left text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Vozilo{sortIndicator("plate")}
            </th>
            <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Obdobje</th>
            <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Zadnja datoteka</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {sorted.map((v) => (
            <tr key={v.id}>
              <td className="px-3 py-2">
                <ScheduleToggle id={v.id} checked={v.tachoScheduleEnabled} action={action} />
              </td>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{v.plate}</td>
              <td className="px-3 py-2">
                <span
                  title={`Urnik: vsakih ${VEHICLE_PERIOD_DAYS} dni (EU)`}
                  className="inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300"
                >
                  <CalendarIcon />
                  {VEHICLE_PERIOD_DAYS} dni
                </span>
              </td>
              <td className="px-3 py-2">
                {v.lastFile ? (
                  <a
                    href={`/tacho/pregled/${v.lastFile.id}`}
                    title="Odpri datoteko"
                    className="inline-flex items-center gap-1.5 text-sm text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
                  >
                    <FileIcon />
                    {fmtDate(v.lastFile.downloadedAt)}
                  </a>
                ) : (
                  <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                )}
              </td>
            </tr>
          ))}
          {vehicles.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Ni vozil.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
