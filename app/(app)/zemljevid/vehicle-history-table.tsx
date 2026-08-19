"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { updateVisibleVehicleFields } from "@/app/(app)/vozila/actions";
import type { HistoryRow } from "@/lib/history-data";
import { haversineKm } from "@/lib/trips";

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

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// Sešteje razdaljo med zaporednimi točkami (v podanem vrstnem redu — klicatelj poskrbi za sortiranje).
// Točke z manjkajočim/neveljavnim GPS fixom preskoči, namesto da bi vrnile napačno razdaljo.
function computeDistanceKm(points: HistoryRow[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const lat1 = toFiniteNumber(points[i - 1].latitude);
    const lon1 = toFiniteNumber(points[i - 1].longitude);
    const lat2 = toFiniteNumber(points[i].latitude);
    const lon2 = toFiniteNumber(points[i].longitude);
    if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) continue;
    total += haversineKm(lat1, lon1, lat2, lon2);
  }
  return total;
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
  const pickerRef = useRef<HTMLDivElement>(null);

  // Ročica za spremembo višine spodaj -- 512px (prejšnji fiksni max-h-[32rem]) ostane privzeta
  // višina, uporabnik pa jo lahko po potrebi poveča/zmanjša, enako kot pri zemljevidu.
  const [tableHeight, setTableHeight] = useState(512);
  const heightDragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      const drag = heightDragRef.current;
      if (!drag) return;
      setTableHeight(Math.max(200, drag.startHeight + (e.clientY - drag.startY)));
    }
    function handleMouseUp() {
      heightDragRef.current = null;
    }
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  function handleHeightHandleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    heightDragRef.current = {
      startY: e.clientY,
      startHeight: scrollContainerRef.current?.getBoundingClientRect().height ?? tableHeight,
    };
  }

  useEffect(() => {
    if (!pickerOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [pickerOpen]);

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

  // Auto-scroll ob vlečenju blizu zgornjega/spodnjega roba scrollable vsebnika (glej efekt spodaj).
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollDirRef = useRef<0 | 1 | -1>(0);
  const autoScrollSpeedRef = useRef(0);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const autoScrollRafRef = useRef<number | null>(null);

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

  // Vedno sveža referenca na trenutni handleRowMouseEnter (zapre nad trenutnim sortedRows/commitRange),
  // da jo lahko kliče rAF zanka spodaj, ne da bi jo bilo treba dodajati med odvisnosti tistega
  // mount-only efekta (kar bi zahtevalo prevezovanje window listenerja ob vsakem renderju).
  const handleRowMouseEnterRef = useRef(handleRowMouseEnter);
  handleRowMouseEnterRef.current = handleRowMouseEnter;

  useEffect(() => {
    function stopDragging() {
      draggingRef.current = false;
      autoScrollDirRef.current = 0;
    }
    window.addEventListener("mouseup", stopDragging);
    return () => window.removeEventListener("mouseup", stopDragging);
  }, []);

  // Ctrl+A izbere vse vrstice TE tabele, ko je miška nad njo -- namesto privzetega izbiranja
  // celotnega besedila strani. Ref, ker je efekt spodaj mount-only (isti razlog kot zgoraj).
  const isHoveredRef = useRef(false);
  const selectAllRef = useRef(() => {});
  selectAllRef.current = () => onSelectedIndicesChange(new Set(rows.map((_, i) => i)));

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isHoveredRef.current) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        selectAllRef.current();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Ko uporabnik vleče izbiro blizu zgornjega/spodnjega roba scrollable tabele, samodejno scrollamo
  // v to smer, dokler se uporabnik ne vrne stran od roba ali ne spusti miškinega gumba — tudi
  // če miška medtem miruje (zato rAF zanka, ne le mousemove: vsebina se premika pod nepremičnim
  // kurzorjem, zato se mouseenter ne bo zanesljivo sprožil sam in vrstico pod kurzorjem moramo
  // na vsak frame poiskati ročno prek document.elementFromPoint).
  // Deluje čez cel zaslon (ne samo tik ob robu tabele): karkoli nad tabelo scrolla navzgor,
  // karkoli pod njo navzdol, hitrost pa narašča, dokler ne prideš do konca zaslona.
  useEffect(() => {
    const EDGE_PX = 48; // cona tik znotraj tabele, kjer se ze zacne scrollati
    const MIN_SPEED = 10;
    const MAX_SPEED = 60;
    const MAX_DISTANCE_PX = 400; // razdalja od roba tabele do zaslona, pri kateri dosezemo MAX_SPEED

    function computeScroll(clientY: number, rect: DOMRect, atTop: boolean, atBottom: boolean): { dir: 0 | 1 | -1; speed: number } {
      if (clientY < rect.top) {
        if (atTop) return { dir: 0, speed: 0 };
        const dist = rect.top - clientY;
        return { dir: -1, speed: MIN_SPEED + (MAX_SPEED - MIN_SPEED) * Math.min(dist / MAX_DISTANCE_PX, 1) };
      }
      if (clientY > rect.bottom) {
        if (atBottom) return { dir: 0, speed: 0 };
        const dist = clientY - rect.bottom;
        return { dir: 1, speed: MIN_SPEED + (MAX_SPEED - MIN_SPEED) * Math.min(dist / MAX_DISTANCE_PX, 1) };
      }
      if (clientY - rect.top < EDGE_PX && !atTop) return { dir: -1, speed: MIN_SPEED };
      if (rect.bottom - clientY < EDGE_PX && !atBottom) return { dir: 1, speed: MIN_SPEED };
      return { dir: 0, speed: 0 };
    }

    function runAutoScrollStep() {
      autoScrollRafRef.current = null;

      const container = scrollContainerRef.current;
      if (!draggingRef.current || autoScrollDirRef.current === 0 || !container) return;

      container.scrollTop += autoScrollDirRef.current * autoScrollSpeedRef.current;

      const { x, y } = lastMouseRef.current;
      const el = document.elementFromPoint(x, y);
      const rowEl = el?.closest("[data-display-index]") ?? null;
      if (rowEl) {
        const attr = rowEl.getAttribute("data-display-index");
        const idx = attr === null ? NaN : Number(attr);
        if (Number.isFinite(idx)) handleRowMouseEnterRef.current(idx);
      }

      // Opomba: autoScrollDirRef.current je tu zagotovo se vedno != 0 (zgornji zgodnji "return" bi
      // sicer ze koncal funkcijo), zato ponovno preverjanje ni potrebno - le se draggingRef.current.
      if (draggingRef.current) {
        autoScrollRafRef.current = requestAnimationFrame(runAutoScrollStep);
      }
    }

    function ensureAutoScrollLoop() {
      if (autoScrollRafRef.current === null) {
        autoScrollRafRef.current = requestAnimationFrame(runAutoScrollStep);
      }
    }

    function handleWindowMouseMove(e: MouseEvent) {
      lastMouseRef.current = { x: e.clientX, y: e.clientY };

      const container = scrollContainerRef.current;
      if (!draggingRef.current || !container) {
        autoScrollDirRef.current = 0;
        return;
      }

      const rect = container.getBoundingClientRect();
      const atTop = container.scrollTop <= 1;
      const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 1;

      const { dir, speed } = computeScroll(e.clientY, rect, atTop, atBottom);
      autoScrollDirRef.current = dir;
      autoScrollSpeedRef.current = speed;
      if (dir !== 0) ensureAutoScrollLoop();
    }

    window.addEventListener("mousemove", handleWindowMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      if (autoScrollRafRef.current !== null) {
        cancelAnimationFrame(autoScrollRafRef.current);
        autoScrollRafRef.current = null;
      }
    };
  }, []);

  const totalDistanceKm = useMemo(() => computeDistanceKm(rows), [rows]);

  // Izbira ni nujno kronološka (vlečenje od spodaj navzgor vstavi indekse v obratnem vrstnem redu v Set),
  // zato pred računanjem razdalje eksplicitno sortiramo po fixTime — enako kot za highlight pot na zemljevidu
  // (glej vehicles-panel.tsx).
  const selectedDistanceKm = useMemo(() => {
    const subset = Array.from(selectedIndices)
      .map((i) => rows[i])
      .filter((r): r is HistoryRow => Boolean(r))
      .sort((a, b) => a.fixTime.localeCompare(b.fixTime));
    return computeDistanceKm(subset);
  }, [selectedIndices, rows]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Zgodovina pozicij ({rows.length})
          <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">
            — {totalDistanceKm.toFixed(1)} km
          </span>
          {selectedIndices.size > 0 && (
            <span className="ml-2 font-normal text-amber-700 dark:text-amber-400">
              — izbranih {selectedIndices.size} ({selectedDistanceKm.toFixed(1)} km)
            </span>
          )}
        </h3>
        <div ref={pickerRef} className="relative flex shrink-0 gap-2">
          <a
            href={exportHref}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            Izvozi podatke
          </a>
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
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
        <div
          ref={scrollContainerRef}
          onMouseEnter={() => {
            isHoveredRef.current = true;
          }}
          onMouseLeave={() => {
            isHoveredRef.current = false;
          }}
          style={{ height: tableHeight }}
          className="relative overflow-auto rounded-md border border-gray-200 dark:border-gray-700"
        >
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
                    data-display-index={displayIndex}
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

          <div
            onMouseDown={handleHeightHandleMouseDown}
            title="Povleci za spremembo višine"
            className="absolute inset-x-0 bottom-0 z-20 flex h-3 cursor-ns-resize items-center justify-center hover:bg-black/10 dark:hover:bg-white/10"
          >
            <div className="h-1 w-10 rounded-full bg-gray-400/80 dark:bg-gray-300/70" />
          </div>
        </div>
      )}
    </div>
  );
}
