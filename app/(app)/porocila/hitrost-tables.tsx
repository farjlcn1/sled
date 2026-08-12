"use client";

import { useMemo, useState } from "react";
import type { SpeedReport } from "@/lib/report-types";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("sl-SI", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

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

type OverspeedEvent = SpeedReport["overspeedEvents"][number];
type OverspeedColumnKey = "time" | "speed";

const OVERSPEED_COLUMNS: { key: OverspeedColumnKey; label: string }[] = [
  { key: "time", label: "Čas" },
  { key: "speed", label: "Hitrost" },
];

function overspeedSortValue(e: OverspeedEvent, key: OverspeedColumnKey): string | number {
  switch (key) {
    case "time":
      return e.time;
    case "speed":
      return e.speedKmh;
  }
}

export function OverspeedTable({ events }: { events: OverspeedEvent[] }) {
  const [sort, setSort] = useState<{ key: OverspeedColumnKey; dir: SortDir } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return events;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...events].sort((a, b) => factor * compare(overspeedSortValue(a, sort.key), overspeedSortValue(b, sort.key)));
  }, [events, sort]);

  function handleSort(key: OverspeedColumnKey) {
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function sortIndicator(key: OverspeedColumnKey) {
    if (sort?.key !== key) return "";
    return sort.dir === "asc" ? " ▲" : " ▼";
  }

  return (
    <div className="max-h-72 overflow-auto rounded-md border border-gray-200 dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
          <tr>
            {OVERSPEED_COLUMNS.map((col) => (
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
          {sorted.map((e, i) => (
            <tr key={i}>
              <td className="px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100">{fmtTimeSec(e.time)}</td>
              <td className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400">{e.speedKmh} km/h</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type TripSpeed = SpeedReport["tripSpeeds"][number];
type TripSpeedColumnKey = "start" | "end" | "avgSpeed" | "maxSpeed";

const TRIP_SPEED_COLUMNS: { key: TripSpeedColumnKey; label: string }[] = [
  { key: "start", label: "Začetek" },
  { key: "end", label: "Konec" },
  { key: "avgSpeed", label: "Povp. hitrost" },
  { key: "maxSpeed", label: "Najv. hitrost" },
];

function tripSpeedSortValue(t: TripSpeed, key: TripSpeedColumnKey): string | number {
  switch (key) {
    case "start":
      return t.startTime;
    case "end":
      return t.endTime;
    case "avgSpeed":
      return t.avgSpeedKmh;
    case "maxSpeed":
      return t.maxSpeedKmh;
  }
}

export function TripSpeedsTable({ tripSpeeds }: { tripSpeeds: TripSpeed[] }) {
  const [sort, setSort] = useState<{ key: TripSpeedColumnKey; dir: SortDir } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return tripSpeeds;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...tripSpeeds].sort((a, b) => factor * compare(tripSpeedSortValue(a, sort.key), tripSpeedSortValue(b, sort.key)));
  }, [tripSpeeds, sort]);

  function handleSort(key: TripSpeedColumnKey) {
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function sortIndicator(key: TripSpeedColumnKey) {
    if (sort?.key !== key) return "";
    return sort.dir === "asc" ? " ▲" : " ▼";
  }

  return (
    <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {TRIP_SPEED_COLUMNS.map((col) => (
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
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{t.avgSpeedKmh} km/h</td>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{t.maxSpeedKmh} km/h</td>
            </tr>
          ))}
          {tripSpeeds.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Ni voženj v izbranem obdobju.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
