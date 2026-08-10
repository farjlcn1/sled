"use client";

import { useTransition } from "react";
import { setDriverPeriod } from "./actions";

export function PeriodInput({ driverId, days }: { driverId: string; days: number }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={1}
        max={90}
        defaultValue={days}
        disabled={pending}
        onBlur={(e) => {
          const value = Number(e.target.value);
          if (value !== days) startTransition(() => setDriverPeriod(driverId, value));
        }}
        className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      />
      <span className="text-xs text-gray-500 dark:text-gray-400">dni</span>
    </div>
  );
}
