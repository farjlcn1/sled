"use client";

import { useMemo, useState } from "react";
import type { Stop } from "@/lib/trips";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("sl-SI", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

type SortDir = "asc" | "desc";
type ColumnKey = "start" | "end" | "duration";

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "start", label: "Začetek" },
  { key: "end", label: "Konec" },
  { key: "duration", label: "Trajanje" },
];

function sortValue(s: Stop, key: ColumnKey): string | number {
  switch (key) {
    case "start":
      return s.startTime;
    case "end":
      return s.endTime;
    case "duration":
      return s.durationMin;
  }
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "sl-SI", { numeric: true });
}

export function PostankiTable({ stops }: { stops: Stop[] }) {
  const [sort, setSort] = useState<{ key: ColumnKey; dir: SortDir } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return stops;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...stops].sort((a, b) => factor * compare(sortValue(a, sort.key), sortValue(b, sort.key)));
  }, [stops, sort]);

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
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {sorted.map((s, i) => (
            <tr key={i}>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{fmtTime(s.startTime)}</td>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{fmtTime(s.endTime)}</td>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                {s.durationMin >= 60 ? `${(s.durationMin / 60).toFixed(1)} h` : `${Math.round(s.durationMin)} min`}
              </td>
            </tr>
          ))}
          {stops.length === 0 && (
            <tr>
              <td colSpan={3} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Ni postankov v izbranem obdobju.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
