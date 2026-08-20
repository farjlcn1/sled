"use client";

import { useMemo, useState } from "react";
import { ACTION_LABELS, ENTITY_LABELS } from "@/lib/audit-labels";

export { ACTION_LABELS, ENTITY_LABELS };

export type AuditLogRow = {
  id: string;
  createdAt: string;
  userEmail: string;
  action: string;
  entityType: string;
  entityLabel: string | null;
  changesSummary: string | null;
};

type SortDir = "asc" | "desc";
type ColumnKey = "createdAt" | "userEmail" | "action" | "entityType" | "entityLabel";

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "createdAt", label: "Čas" },
  { key: "userEmail", label: "Uporabnik" },
  { key: "action", label: "Akcija" },
  { key: "entityType", label: "Vrsta" },
  { key: "entityLabel", label: "Oznaka" },
];

function sortValue(row: AuditLogRow, key: ColumnKey): string | number {
  switch (key) {
    case "createdAt":
      return new Date(row.createdAt).getTime();
    case "userEmail":
      return row.userEmail;
    case "action":
      return ACTION_LABELS[row.action] ?? row.action;
    case "entityType":
      return ENTITY_LABELS[row.entityType] ?? row.entityType;
    case "entityLabel":
      return row.entityLabel ?? "";
  }
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "sl-SI", { numeric: true });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("sl-SI", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function AuditLogTable({ rows }: { rows: AuditLogRow[] }) {
  const [sort, setSort] = useState<{ key: ColumnKey; dir: SortDir } | null>(null);

  const sortedRows = useMemo(() => {
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
            <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Podrobnosti</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {sortedRows.map((row) => (
            <tr key={row.id}>
              <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                {fmtDateTime(row.createdAt)}
              </td>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{row.userEmail}</td>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                {ACTION_LABELS[row.action] ?? row.action}
              </td>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                {ENTITY_LABELS[row.entityType] ?? row.entityType}
              </td>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{row.entityLabel ?? "—"}</td>
              <td className="max-w-xs px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                {row.changesSummary ?? "—"}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Ni dogodkov, ki bi ustrezali filtru.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
