"use client";

import { useMemo, useState } from "react";
import { updateVisibleVehicleFields } from "@/app/(app)/vozila/actions";
import type { HistoryRow } from "@/lib/history-data";

function formatFieldLabel(key: string): string {
  const spaced = key.replace(/([A-Z])/g, " $1");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatFieldValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "Da" : "Ne";
  if (value === null || value === undefined) return "—";
  return String(value);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("sl-SI", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function VehicleHistoryTable({
  rows,
  initialVisibleFields,
  exportHref,
}: {
  rows: HistoryRow[];
  initialVisibleFields: string[];
  exportHref: string;
}) {
  const [visibleFields, setVisibleFields] = useState<string[]>(initialVisibleFields);
  const [pickerOpen, setPickerOpen] = useState(false);

  const availableKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        if (key !== "fixTime") keys.add(key);
      }
    }
    return Array.from(keys).sort();
  }, [rows]);

  function toggleField(key: string) {
    const next = visibleFields.includes(key) ? visibleFields.filter((f) => f !== key) : [...visibleFields, key];
    setVisibleFields(next);
    updateVisibleVehicleFields(next);
  }

  const shownFields = visibleFields.filter((f) => availableKeys.includes(f));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Zgodovina pozicij ({rows.length})</h3>
        <div className="relative flex shrink-0 gap-2">
          <a
            href={exportHref}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Izvozi podatke
          </a>
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Izberi podatke
          </button>
          {pickerOpen && (
            <div className="absolute right-0 z-10 mt-1 max-h-72 w-64 overflow-y-auto rounded-md border border-gray-300 bg-white p-3 shadow-lg dark:border-gray-600 dark:bg-gray-800">
              {availableKeys.length === 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">Ni podatkov naprave.</p>
              )}
              {availableKeys.map((key) => (
                <label key={key} className="flex items-center gap-2 py-1 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={visibleFields.includes(key)} onChange={() => toggleField(key)} />
                  {formatFieldLabel(key)}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Ni podatkov v izbranem obdobju.</p>
      ) : (
        <div className="max-h-[32rem] overflow-auto rounded-md border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">
                  Čas
                </th>
                {shownFields.map((key) => (
                  <th
                    key={key}
                    className="whitespace-nowrap px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400"
                  >
                    {formatFieldLabel(key)}
                  </th>
                ))}
                {shownFields.length === 0 && (
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">
                    (izberi podatke za prikaz)
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap px-3 py-1.5 text-gray-900 dark:text-gray-100">
                    {formatTime(row.fixTime)}
                  </td>
                  {shownFields.map((key) => (
                    <td key={key} className="whitespace-nowrap px-3 py-1.5 text-gray-900 dark:text-gray-100">
                      {formatFieldValue(row[key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
