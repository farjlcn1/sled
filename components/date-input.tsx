"use client";

import { useEffect, useRef, useState } from "react";

// Nativni brskalnikov datumski/časovni pojavni del je nezanesljiv (druga oblika po brskalniku,
// pri "datetime-local" pa je bil del z uro stisnjen/komaj viden) -- zato je koledarček tu v celoti
// naš: klik na polje/ikono odpre EN pojavni okvir, ki vsebuje mesečni koledar IN (če withTime)
// izbiro ure/minute, vse skupaj, enako v vsakem brskalniku.
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDatePart(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return "";
  return `${d}.${m}.${y}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// JS Date.getDay(): 0=nedelja..6=sobota -> pretvori v slovensko/evropsko konvencijo, kjer teden
// naprej se začne v ponedeljek (0=ponedeljek..6=nedelja).
function mondayIndex(jsDay: number): number {
  return (jsDay + 6) % 7;
}

const MONTH_NAMES = [
  "Januar", "Februar", "Marec", "April", "Maj", "Junij",
  "Julij", "Avgust", "September", "Oktober", "November", "December",
];
const DAY_LABELS = ["P", "T", "S", "Č", "P", "S", "N"];
const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad2(i));

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500"
    >
      <rect x="3" y="4" width="14" height="13" rx="1.5" />
      <path d="M3 8h14M6.5 2.5v3M13.5 2.5v3" strokeLinecap="round" />
    </svg>
  );
}

function selectClass() {
  return "rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
}

export function SlovenianDateInput({
  name,
  defaultValue,
  required,
  withTime = false,
  className,
  onValueChange,
}: {
  name?: string;
  defaultValue?: string; // "YYYY-MM-DD" ali (withTime) "YYYY-MM-DDTHH:mm"
  required?: boolean;
  withTime?: boolean;
  className?: string;
  // Za primere, ko klicatelj vrednost pošlje na strežnik po svoje (npr. pretvorjeno v UTC prek
  // skritega polja) namesto prek imenovanega polja tega vnosa — glej rezervacije/calendar.tsx.
  onValueChange?: (value: string) => void;
}) {
  const [datePart, setDatePart] = useState(() => (defaultValue ? defaultValue.slice(0, 10) : ""));
  const [hour, setHour] = useState(() => (defaultValue && withTime ? defaultValue.slice(11, 13) || "09" : "09"));
  const [minute, setMinute] = useState(() => (defaultValue && withTime ? defaultValue.slice(14, 16) || "00" : "00"));
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const initial = datePart ? new Date(`${datePart}T00:00:00`) : new Date();
  const [viewYear, setViewYear] = useState(() => initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => initial.getMonth());

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function combined(d: string, h: string, m: string): string {
    if (!withTime) return d;
    return d ? `${d}T${h}:${m}` : "";
  }

  function emitDate(next: string) {
    setDatePart(next);
    onValueChange?.(combined(next, hour, minute));
  }
  function emitHour(next: string) {
    setHour(next);
    onValueChange?.(combined(datePart, next, minute));
  }
  function emitMinute(next: string) {
    setMinute(next);
    onValueChange?.(combined(datePart, hour, next));
  }

  function pickDay(day: number) {
    const iso = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`;
    emitDate(iso);
    if (!withTime) setOpen(false);
  }

  function openPicker() {
    setOpen((v) => !v);
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }
  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  const firstWeekday = mondayIndex(new Date(viewYear, viewMonth, 1).getDay());
  const totalDays = daysInMonth(viewYear, viewMonth);
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  const selectedDay =
    datePart && Number(datePart.slice(0, 4)) === viewYear && Number(datePart.slice(5, 7)) === viewMonth + 1
      ? Number(datePart.slice(8, 10))
      : null;

  const combinedValue = combined(datePart, hour, minute);

  return (
    <div ref={containerRef} className="relative">
      <div
        onClick={openPicker}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        className={`flex cursor-pointer items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 ${className ?? "mt-1 w-full"}`}
      >
        <span className={datePart ? "" : "text-gray-400 dark:text-gray-500"}>
          {datePart
            ? `${formatDatePart(datePart)}${withTime ? `  ${hour}:${minute}` : ""}`
            : withTime
              ? "dd.mm.llll  uu:mm"
              : "dd.mm.llll"}
        </span>
        <CalendarIcon />
      </div>

      {/* required deluje samo na pravih (ne type=hidden) vnosih -- zato text, ne hidden, a vizualno skrit. */}
      {name && (
        <input type="text" name={name} value={combinedValue} required={required} readOnly className="sr-only" tabIndex={-1} />
      )}

      {open && (
        <div className="absolute left-0 z-30 mt-1 w-64 rounded-md border border-gray-300 bg-white p-3 shadow-lg dark:border-gray-600 dark:bg-gray-800">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={prevMonth}
              className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              ‹
            </button>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
            {DAY_LABELS.map((d, i) => (
              <div key={i} className="py-1 font-medium text-gray-400 dark:text-gray-500">
                {d}
              </div>
            ))}
            {cells.map((day, i) => (
              <button
                key={i}
                type="button"
                disabled={day === null}
                onClick={() => day && pickDay(day)}
                className={
                  day === null
                    ? ""
                    : day === selectedDay
                      ? "rounded bg-blue-600 py-1 text-white"
                      : "rounded py-1 text-gray-700 hover:bg-blue-50 dark:text-gray-300 dark:hover:bg-gray-700"
                }
              >
                {day ?? ""}
              </button>
            ))}
          </div>

          {withTime && (
            <div className="mt-3 flex items-center justify-center gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
              <select value={hour} onChange={(e) => emitHour(e.target.value)} className={selectClass()}>
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span className="text-gray-500 dark:text-gray-400">:</span>
              <select value={minute} onChange={(e) => emitMinute(e.target.value)} className={selectClass()}>
                {MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          {withTime && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white"
              >
                Potrdi
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
