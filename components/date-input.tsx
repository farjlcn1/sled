"use client";

import { useRef, useState } from "react";

// Prikazano besedilo je vedno v slovenski obliki (dd.mm.llll), ne glede na jezik/regijo brskalnika
// uporabnika — nativni <input type="date"> namreč prikazuje svojo LASTNO obliko po jeziku
// BRSKALNIKA (ne strani), kar CSS/atribut lang na strani ne more zanesljivo spremeniti. Zato je
// nativni vnos vizualno skrit (sr-only, a še vedno v celoti deluje s tipkovnico in odpre pravi
// brskalnikov koledarček), prikazano besedilo pa oblikujemo sami.
//
// Ura in minuta (withTime) NISTA del tega nativnega vnosa -- brskalnikov "datetime-local" pojavni
// koledarček z uro se je v praksi izkazal za nezanesljivega/različnega med brskalniki (stisnjen,
// delno neviden). Zato sta ura in minuta ločena, navadna <select> polja, ki delujeta enako povsod.
function formatDatePart(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return "";
  return `${d}.${m}.${y}`;
}

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

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function selectClass() {
  return "rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [datePart, setDatePart] = useState(() => (defaultValue ? defaultValue.slice(0, 10) : ""));
  const [hour, setHour] = useState(() => (defaultValue && withTime ? defaultValue.slice(11, 13) || "09" : "09"));
  const [minute, setMinute] = useState(() => (defaultValue && withTime ? defaultValue.slice(14, 16) || "00" : "00"));

  function openPicker() {
    inputRef.current?.focus();
    inputRef.current?.showPicker?.();
  }

  function combined(d: string, h: string, m: string) {
    if (!withTime) return d;
    return d ? `${d}T${h}:${m}` : "";
  }

  function handleDateChange(next: string) {
    setDatePart(next);
    onValueChange?.(combined(next, hour, minute));
  }

  function handleHourChange(next: string) {
    setHour(next);
    onValueChange?.(combined(datePart, next, minute));
  }

  function handleMinuteChange(next: string) {
    setMinute(next);
    onValueChange?.(combined(datePart, hour, next));
  }

  return (
    <div className="flex items-center gap-2">
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
          {datePart ? formatDatePart(datePart) : "dd.mm.llll"}
        </span>
        <CalendarIcon />
        <input
          ref={inputRef}
          type="date"
          name={withTime ? undefined : name}
          required={required}
          value={datePart}
          onChange={(e) => handleDateChange(e.target.value)}
          className="sr-only"
          tabIndex={-1}
        />
      </div>
      {withTime && (
        <>
          <select value={hour} onChange={(e) => handleHourChange(e.target.value)} className={selectClass()}>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          <span className="text-gray-500 dark:text-gray-400">:</span>
          <select value={minute} onChange={(e) => handleMinuteChange(e.target.value)} className={selectClass()}>
            {MINUTES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {name && <input type="hidden" name={name} value={combined(datePart, hour, minute)} />}
        </>
      )}
    </div>
  );
}
