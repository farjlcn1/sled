"use client";

import { useMemo, useState } from "react";
import type { FuelReport } from "@/lib/report-types";

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

function compare(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "sl-SI", { numeric: true });
}

type FuelDrop = FuelReport["drops"][number];
type DropColumnKey = "from" | "to" | "delta";

const DROP_COLUMNS: { key: DropColumnKey; label: string }[] = [
  { key: "from", label: "Od" },
  { key: "to", label: "Do" },
  { key: "delta", label: "Sprememba" },
];

function dropSortValue(d: FuelDrop, key: DropColumnKey): string | number {
  switch (key) {
    case "from":
      return d.fromTime;
    case "to":
      return d.toTime;
    case "delta":
      return d.deltaPct;
  }
}

export function FuelDropsTable({ drops }: { drops: FuelDrop[] }) {
  const [sort, setSort] = useState<{ key: DropColumnKey; dir: SortDir } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return drops;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...drops].sort((a, b) => factor * compare(dropSortValue(a, sort.key), dropSortValue(b, sort.key)));
  }, [drops, sort]);

  function handleSort(key: DropColumnKey) {
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function sortIndicator(key: DropColumnKey) {
    if (sort?.key !== key) return "";
    return sort.dir === "asc" ? " ▲" : " ▼";
  }

  return (
    <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {DROP_COLUMNS.map((col) => (
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
          {sorted.map((d, i) => (
            <tr key={i}>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                {fmtTimeSec(d.fromTime)} ({d.fromPct} %)
              </td>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                {fmtTimeSec(d.toTime)} ({d.toPct} %)
              </td>
              <td className="px-3 py-2 text-sm text-red-600 dark:text-red-400">-{d.deltaPct} %</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type FuelReading = FuelReport["readings"][number];
type ReadingColumnKey = "time" | "fuel";

const READING_COLUMNS: { key: ReadingColumnKey; label: string }[] = [
  { key: "time", label: "Čas" },
  { key: "fuel", label: "Gorivo" },
];

function readingSortValue(r: FuelReading, key: ReadingColumnKey): string | number {
  switch (key) {
    case "time":
      return r.time;
    case "fuel":
      return r.fuelPct;
  }
}

export function FuelReadingsTable({ readings }: { readings: FuelReading[] }) {
  const [sort, setSort] = useState<{ key: ReadingColumnKey; dir: SortDir } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return readings;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...readings].sort((a, b) => factor * compare(readingSortValue(a, sort.key), readingSortValue(b, sort.key)));
  }, [readings, sort]);

  function handleSort(key: ReadingColumnKey) {
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function sortIndicator(key: ReadingColumnKey) {
    if (sort?.key !== key) return "";
    return sort.dir === "asc" ? " ▲" : " ▼";
  }

  return (
    <div className="max-h-96 overflow-auto rounded-md border border-gray-200 dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
          <tr>
            {READING_COLUMNS.map((col) => (
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
          {sorted.map((r, i) => (
            <tr key={i}>
              <td className="px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100">{fmtTimeSec(r.time)}</td>
              <td className="px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100">{r.fuelPct} %</td>
            </tr>
          ))}
          {readings.length === 0 && (
            <tr>
              <td colSpan={2} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Naprava ne pošilja podatkov o gorivu.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
