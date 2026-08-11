"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type SortDir = "asc" | "desc";

// null/undefined vedno na koncu (ne glede na smer), da manjkajoči podatki ne "skočijo" na vrh pri obratnem vrstnem redu.
function compareValues(a: unknown, b: unknown): number {
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "sl-SI", { numeric: true });
}

export function VehicleHistoryTable({
  rows,
  initialVisibleFields,
  exportHref,
  selectedIndices,
  onSelectedIndicesChange,
}: {
  rows: HistoryRow[];
  initialVisibleFields: string[];
  exportHref: string;
  selectedIndices: Set<number>;
  onSelectedIndicesChange: (next: Set<number>) => void;
}) {
  const [visibleFields, setVisibleFields] = useState<string[]>(initialVisibleFields);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(null);

  // Nov nabor vrstic (nov datumski obseg / drugo vozilo) -> stara izbira po indeksu ni vec smiselna.
  useEffect(() => {
    onSelectedIndicesChange(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ob spremembi `rows` samo počistimo izbiro, callback ni odvisnost
  }, [rows]);

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

  // originalIndex se ohrani skozi sortiranje, da je izbira vrstic neodvisna od trenutnega vrstnega reda prikaza.
  const indexedRows = useMemo(() => rows.map((row, originalIndex) => ({ row, originalIndex })), [rows]);

  const sortedRows = useMemo(() => {
    if (!sort) return indexedRows;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...indexedRows].sort((a, b) => factor * compareValues(a.row[sort.key], b.row[sort.key]));
  }, [indexedRows, sort]);

  // Prvi klik na stolpec razvrsti naraščajoče (najmanjši -> največji), ponoven klik na isti stolpec obrne smer.
  function handleSort(key: string) {
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function sortIndicator(key: string): string {
    if (sort?.key !== key) return "";
    return sort.dir === "asc" ? " ▲" : " ▼";
  }

  // Izbira vrstic z miško: klik izbere eno, klik-in-vlečenje izbere vse vrstice med začetno in trenutno
  // (po prikazanem vrstnem redu, ne po originalnem), ne glede na trenutno sortiranje.
  const draggingRef = useRef(false);
  const anchorPosRef = useRef<number | null>(null);

  function commitRange(fromPos: number, toPos: number) {
    const lo = Math.min(fromPos, toPos);
    const hi = Math.max(fromPos, toPos);
    const next = new Set<number>();
    for (let p = lo; p <= hi; p++) next.add(sortedRows[p].originalIndex);
    onSelectedIndicesChange(next);
  }

  function handleRowMouseDown(displayIndex: number) {
    draggingRef.current = true;
    anchorPosRef.current = displayIndex;
    commitRange(displayIndex, displayIndex);
  }

  function handleRowMouseEnter(displayIndex: number) {
    if (!draggingRef.current || anchorPosRef.current === null) return;
    commitRange(anchorPosRef.current, displayIndex);
  }

  useEffect(() => {
    function stopDragging() {
      draggingRef.current = false;
    }
    window.addEventListener("mouseup", stopDragging);
    return () => window.removeEventListener("mouseup", stopDragging);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Zgodovina pozicij ({rows.length})
          {selectedIndices.size > 0 && (
            <span className="ml-2 font-normal text-amber-700 dark:text-amber-400">
              — izbranih {selectedIndices.size}
            </span>
          )}
        </h3>
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
                <th
                  onClick={() => handleSort("fixTime")}
                  className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-left font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Čas{sortIndicator("fixTime")}
                </th>
                {shownFields.map((key) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-left font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {formatFieldLabel(key)}
                    {sortIndicator(key)}
                  </th>
                ))}
                {shownFields.length === 0 && (
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">
                    (izberi podatke za prikaz)
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="select-none divide-y divide-gray-200 dark:divide-gray-700">
              {sortedRows.map(({ row, originalIndex }, displayIndex) => {
                const isSelected = selectedIndices.has(originalIndex);
                return (
                  <tr
                    key={originalIndex}
                    onMouseDown={() => handleRowMouseDown(displayIndex)}
                    onMouseEnter={() => handleRowMouseEnter(displayIndex)}
                    title="Klik za izbiro, klik in vlečenje za izbiro več vrstic — izbrano se pobarva na zemljevidu"
                    className={
                      isSelected
                        ? "cursor-pointer bg-amber-100 dark:bg-amber-900"
                        : "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                    }
                  >
                    <td className="whitespace-nowrap px-3 py-1.5 text-gray-900 dark:text-gray-100">
                      {formatTime(row.fixTime)}
                    </td>
                    {shownFields.map((key) => (
                      <td key={key} className="whitespace-nowrap px-3 py-1.5 text-gray-900 dark:text-gray-100">
                        {formatFieldValue(row[key])}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
