"use client";

import { useMemo, useState } from "react";
import type { Trip } from "@/lib/trips";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("sl-SI", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

type SortDir = "asc" | "desc";
type ColumnKey = "start" | "end" | "duration" | "distance" | "maxSpeed";

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "start", label: "Začetek" },
  { key: "end", label: "Konec" },
  { key: "duration", label: "Trajanje" },
  { key: "distance", label: "Razdalja" },
  { key: "maxSpeed", label: "Najv. hitrost" },
];

function sortValue(t: Trip, key: ColumnKey): string | number {
  switch (key) {
    case "start":
      return t.startTime;
    case "end":
      return t.endTime;
    case "duration":
      return t.durationMin;
    case "distance":
      return t.distanceKm;
    case "maxSpeed":
      return t.maxSpeedKmh;
  }
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "sl-SI", { numeric: true });
}

export function VoznjeTable({ trips }: { trips: Trip[] }) {
  const [sort, setSort] = useState<{ key: ColumnKey; dir: SortDir } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return trips;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...trips].sort((a, b) => factor * compare(sortValue(a, sort.key), sortValue(b, sort.key)));
  }, [trips, sort]);

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
          {sorted.map((t, i) => (
            <tr key={i}>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{fmtTime(t.startTime)}</td>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{fmtTime(t.endTime)}</td>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{Math.round(t.durationMin)} min</td>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{t.distanceKm.toFixed(1)} km</td>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{Math.round(t.maxSpeedKmh)} km/h</td>
            </tr>
          ))}
          {trips.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Ni voženj v izbranem obdobju.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
