"use client";

import { useMemo, useState } from "react";
import { CompleteDialog } from "./complete-dialog";
import { LikvidirajButton } from "./likvidiraj-button";

const STATUS_LABELS: Record<string, string> = {
  ODREJEN: "Odrejen",
  V_TEKU: "V teku",
  ZAKLJUCEN: "Zaključen",
  LIKVIDIRAN: "Likvidiran",
};

function fmtDateTime(d: Date) {
  return d.toLocaleString("sl-SI", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export type PotniNalogRow = {
  id: string;
  number: string;
  vehiclePlate: string;
  driverName: string | null;
  purpose: string;
  plannedDepartureAt: string;
  plannedReturnAt: string;
  status: string;
};

type SortDir = "asc" | "desc";
type ColumnKey = "number" | "vehiclePlate" | "driver" | "purpose" | "plannedDepartureAt" | "plannedReturnAt" | "status";

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "number", label: "Št." },
  { key: "vehiclePlate", label: "Vozilo" },
  { key: "driver", label: "Voznik" },
  { key: "purpose", label: "Namen" },
  { key: "plannedDepartureAt", label: "Planiran odhod" },
  { key: "plannedReturnAt", label: "Planirana vrnitev" },
  { key: "status", label: "Status" },
];

function sortValue(n: PotniNalogRow, key: ColumnKey): string | number {
  switch (key) {
    case "number":
      return n.number;
    case "vehiclePlate":
      return n.vehiclePlate;
    case "driver":
      return n.driverName ?? "";
    case "purpose":
      return n.purpose;
    case "plannedDepartureAt":
      return new Date(n.plannedDepartureAt).getTime();
    case "plannedReturnAt":
      return new Date(n.plannedReturnAt).getTime();
    case "status":
      return STATUS_LABELS[n.status] ?? n.status;
  }
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "sl-SI", { numeric: true });
}

export function NalogiTable({ rows }: { rows: PotniNalogRow[] }) {
  const [sort, setSort] = useState<{ key: ColumnKey; dir: SortDir } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => factor * compare(sortValue(a, sort.key), sortValue(b, sort.key)));
  }, [rows, sort]);

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
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {sorted.map((n) => (
            <tr key={n.id}>
              <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">{n.number}</td>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{n.vehiclePlate}</td>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{n.driverName ?? "—"}</td>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{n.purpose}</td>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{fmtDateTime(new Date(n.plannedDepartureAt))}</td>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{fmtDateTime(new Date(n.plannedReturnAt))}</td>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{STATUS_LABELS[n.status]}</td>
              <td className="px-3 py-2 text-right">
                <div className="flex items-center justify-end gap-2">
                  <a
                    href={`/potni-nalogi/${n.id}/print`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 dark:border-gray-600 dark:text-gray-300"
                  >
                    Natisni
                  </a>
                  {(n.status === "ODREJEN" || n.status === "V_TEKU") && (
                    <CompleteDialog
                      nalogId={n.id}
                      plannedDepartureAt={n.plannedDepartureAt}
                      plannedReturnAt={n.plannedReturnAt}
                    />
                  )}
                  {n.status === "ZAKLJUCEN" && <LikvidirajButton nalogId={n.id} />}
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length + 1} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Ni še potnih nalogov.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
