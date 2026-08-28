"use client";

import { useMemo, useState } from "react";
import { ScheduleToggle } from "./schedule-toggle";
import { SelectAllToggle } from "./select-all-toggle";
import { CalendarIcon, FileIcon } from "./icons";

export type DriverScheduleRow = {
  id: string;
  fullName: string;
  tachoScheduleEnabled: boolean;
  tachoDownloadPeriodDays: number;
  lastFile: { id: string; downloadedAt: Date } | null;
};

type SortDir = "asc" | "desc";
type ColumnKey = "fullName" | "tachoDownloadPeriodDays";

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "fullName", label: "Voznik" },
  { key: "tachoDownloadPeriodDays", label: "Obdobje" },
];

function fmtDate(d: Date): string {
  return d.toLocaleDateString("sl-SI", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function sortValue(row: DriverScheduleRow, key: ColumnKey): string | number {
  switch (key) {
    case "fullName":
      return row.fullName;
    case "tachoDownloadPeriodDays":
      return row.tachoDownloadPeriodDays;
  }
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "sl-SI", { numeric: true });
}

export function DriverScheduleTable({
  drivers,
  action,
  tenantId,
  selectAllAction,
}: {
  drivers: DriverScheduleRow[];
  action: (id: string, checked: boolean) => Promise<void>;
  tenantId: string;
  selectAllAction: (tenantId: string, checked: boolean) => Promise<void>;
}) {
  const [sort, setSort] = useState<{ key: ColumnKey; dir: SortDir } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return drivers;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...drivers].sort((a, b) => factor * compare(sortValue(a, sort.key), sortValue(b, sort.key)));
  }, [drivers, sort]);

  function handleSort(key: ColumnKey) {
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function sortIndicator(key: ColumnKey) {
    if (sort?.key !== key) return "";
    return sort.dir === "asc" ? " ▲" : " ▼";
  }

  const allChecked = drivers.length > 0 && drivers.every((d) => d.tachoScheduleEnabled);

  return (
    <div className="max-w-2xl overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="w-10 px-3 py-2">
              <SelectAllToggle tenantId={tenantId} action={selectAllAction} allChecked={allChecked} title="Izberi vse voznike" />
            </th>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className="cursor-pointer select-none px-3 py-2 text-left text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {col.label}
                {sortIndicator(col.key)}
              </th>
            ))}
            <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Zadnja datoteka</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {sorted.map((d) => (
            <tr key={d.id}>
              <td className="px-3 py-2">
                <ScheduleToggle id={d.id} checked={d.tachoScheduleEnabled} action={action} />
              </td>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{d.fullName}</td>
              <td className="px-3 py-2">
                <span
                  title={`Urnik: vsakih ${d.tachoDownloadPeriodDays} dni`}
                  className="inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300"
                >
                  <CalendarIcon />
                  {d.tachoDownloadPeriodDays} dni
                </span>
              </td>
              <td className="px-3 py-2">
                {d.lastFile ? (
                  <a
                    href={`/tacho/pregled/${d.lastFile.id}`}
                    title="Odpri datoteko"
                    className="inline-flex items-center gap-1.5 text-sm text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
                  >
                    <FileIcon />
                    {fmtDate(d.lastFile.downloadedAt)}
                  </a>
                ) : (
                  <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                )}
              </td>
            </tr>
          ))}
          {drivers.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Ni voznikov.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
