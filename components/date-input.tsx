"use client";

import { useRef, useState } from "react";

// Prikazano besedilo je vedno v slovenski obliki (dd.mm.llll [uu:mm]), ne glede na jezik/regijo
// brskalnika uporabnika — nativni <input type="date"/"datetime-local"> namreč prikazuje svojo
// LASTNO obliko po jeziku BRSKALNIKA (ne strani), kar CSS/atribut lang na strani ne more zanesljivo
// spremeniti. Zato je nativni vnos vizualno skrit (sr-only, a še vedno v celoti deluje s tipkovnico
// in odpre pravi brskalnikov koledarček), prikazano besedilo pa oblikujemo sami.
function formatDatePart(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return "";
  return `${d}.${m}.${y}`;
}

function formatValue(value: string, withTime: boolean): string {
  if (!value) return "";
  if (!withTime) return formatDatePart(value);
  const [datePart, timePart] = value.split("T");
  const dateFmt = formatDatePart(datePart);
  return timePart ? `${dateFmt}  ${timePart}` : dateFmt;
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

export function SlovenianDateInput({
  name,
  defaultValue,
  required,
  withTime = false,
  className,
  onValueChange,
}: {
  name?: string;
  defaultValue?: string;
  required?: boolean;
  withTime?: boolean;
  className?: string;
  // Za primere, ko klicatelj vrednost pošlje na strežnik po svoje (npr. pretvorjeno v UTC prek
  // skritega polja) namesto prek imenovanega polja tega vnosa — glej rezervacije/calendar.tsx.
  onValueChange?: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue ?? "");

  function openPicker() {
    inputRef.current?.focus();
    inputRef.current?.showPicker?.();
  }

  return (
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
      <span className={value ? "" : "text-gray-400 dark:text-gray-500"}>
        {value ? formatValue(value, withTime) : withTime ? "dd.mm.llll  uu:mm" : "dd.mm.llll"}
      </span>
      <CalendarIcon />
      <input
        ref={inputRef}
        type={withTime ? "datetime-local" : "date"}
        name={name}
        required={required}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          onValueChange?.(e.target.value);
        }}
        className="sr-only"
        tabIndex={-1}
      />
    </div>
  );
}
