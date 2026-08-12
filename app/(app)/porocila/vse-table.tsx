"use client";

import { useMemo, useState } from "react";
import type { AllDataRow } from "@/lib/report-types";

function fmtTimeSec(iso: string) {
  return new Date(iso).toLocaleString("sl-SI", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

type SortDir = "asc" | "desc";

function sortValue(row: AllDataRow, key: string): string {
  if (key === "fixTime") return row.fixTime;
  return String(row[key] ?? "");
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "sl-SI", { numeric: true });
}

export function VseTable({ rows, keys }: { rows: AllDataRow[]; keys: string[] }) {
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => factor * compare(sortValue(a, sort.key), sortValue(b, sort.key)));
  }, [rows, sort]);

  function handleSort(key: string) {
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function sortIndicator(key: string) {
    if (sort?.key !== key) return "";
    return sort.dir === "asc" ? " ▲" : " ▼";
  }

  return (
    <div className="max-h-[32rem] overflow-auto rounded-md border border-gray-200 dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
        <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
          <tr>
            <th
              onClick={() => handleSort("fixTime")}
              className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-left font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Čas{sortIndicator("fixTime")}
            </th>
            {keys.map((k) => (
              <th
                key={k}
                onClick={() => handleSort(k)}
                className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-left font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {k}
                {sortIndicator(k)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {sorted.map((row, i) => (
            <tr key={i}>
              <td className="whitespace-nowrap px-3 py-1.5 text-gray-900 dark:text-gray-100">{fmtTimeSec(row.fixTime)}</td>
              {keys.map((k) => (
                <td key={k} className="whitespace-nowrap px-3 py-1.5 text-gray-900 dark:text-gray-100">
                  {typeof row[k] === "boolean" ? (row[k] ? "Da" : "Ne") : row[k] == null ? "—" : String(row[k])}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={keys.length + 1} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                Ni podatkov v izbranem obdobju.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
