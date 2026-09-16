"use client";

import { useEffect, useRef, useState } from "react";
import { ICON_SVG } from "@/lib/vehicle-icons";
import { VehicleMiniMapSlot } from "@/components/vehicle-mini-map-slot";
import type { MobileVehicleStatus } from "@/app/api/vozila/status-batch/route";
import type { MobileVehicle } from "./domov-client";

// Ista paleta kot zemljevid/vehicle-row.tsx (STATUS_ICON_COLOR) -- namenoma DRUGAČNA od
// zemljevid.tsx zemljevidove palete (tam je "parked" rdeča), ker bi rdeča čez dolg seznam
// mirujočih vozil na majhnem zaslonu delovala preveč alarmantno.
const STATUS_ICON_COLOR: Record<MobileVehicleStatus["status"], string> = {
  driving: "bg-green-500",
  idle: "bg-orange-500",
  parked: "bg-gray-400 dark:bg-gray-500",
  unknown: "bg-gray-400 dark:bg-gray-500",
};

function FuelIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 shrink-0">
      <rect x="3" y="3" width="9" height="14" rx="1" />
      <path d="M5 7h5" strokeLinecap="round" />
      <path d="M12 7h2a1 1 0 0 1 1 1v6a1.5 1.5 0 0 0 3 0V9l-2-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OdometerIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 shrink-0">
      <path d="M3 14a7 7 0 1 1 14 0" strokeLinecap="round" />
      <path d="M10 14l3-4" strokeLinecap="round" />
      <circle cx="10" cy="14" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function MobileVehicleCard({
  vehicle,
  live,
  onSelect,
}: {
  vehicle: MobileVehicle;
  live: MobileVehicleStatus | undefined;
  onSelect: (vehicleId: string) => void;
}) {
  const status = live?.status ?? "unknown";
  const leftRef = useRef<HTMLDivElement>(null);
  const [mapSize, setMapSize] = useState<number | null>(null);

  // aspect-square + self-stretch ne izpelje zanesljivo širine iz raztegnjene višine v flex vrstici
  // (širina kolabira na 0, ker flex glavno os -- širino -- izračuna iz vsebine PRED uporabo
  // aspect-ratio) -- zato dejansko višino leve kolone izmerimo in jo eksplicitno posredujemo kot
  // kvadratno velikost mini-zemljevida (glej vehicle-mini-map-slot.tsx).
  useEffect(() => {
    const el = leftRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setMapSize(entry.contentRect.height));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <button
      type="button"
      onClick={() => onSelect(vehicle.id)}
      className="flex w-full items-stretch gap-3 rounded-md border border-gray-200 bg-white p-3 text-left dark:border-gray-700 dark:bg-gray-800"
    >
      <div ref={leftRef} className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${STATUS_ICON_COLOR[status]}`}
            dangerouslySetInnerHTML={{ __html: ICON_SVG[vehicle.icon] }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-gray-100">{vehicle.plate}</span>
              {vehicle.isPrivateMode && (
                <span className="rounded bg-gray-700 px-1.5 py-0.5 text-[10px] font-medium text-white dark:bg-gray-600">
                  Zasebno
                </span>
              )}
            </div>
            {vehicle.driverName && (
              <div className="truncate text-xs text-gray-500 dark:text-gray-400">{vehicle.driverName}</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 border-t border-gray-100 pt-2 text-xs text-gray-700 dark:border-gray-700 dark:text-gray-300">
          <div className="flex items-center gap-1" title="Gorivo">
            <FuelIcon />
            <span>{live?.fuel != null ? `${Math.round(live.fuel)}%` : "—"}</span>
          </div>
          <div className="flex items-center gap-1" title="Odometer">
            <OdometerIcon />
            <span>{live?.odometer != null ? Math.round(live.odometer) : "—"}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
          <span>Temp: {live?.temperature != null ? `${live.temperature}°C` : "—"}</span>
          <span>RPM: {live?.rpm ?? "—"}</span>
          <span>Obrem.: {live?.engineLoad != null ? `${live.engineLoad}%` : "—"}</span>
        </div>
      </div>

      <VehicleMiniMapSlot lat={live?.lat ?? null} lon={live?.lon ?? null} status={status} size={mapSize} />
    </button>
  );
}
