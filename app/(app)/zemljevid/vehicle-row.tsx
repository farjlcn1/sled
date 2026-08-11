"use client";

import { useEffect, useState } from "react";
import type { VehicleQuickStatus } from "@/app/api/vozila/[id]/status/route";

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

const STATUS_LABEL: Record<VehicleQuickStatus["status"], string> = {
  driving: "Čas vožnje: ",
  idle: "Čas postanka: ",
  parked: "Čas postanka: ",
  unknown: "Čas v trenutnem stanju: ",
};

export function VehicleRow({
  vehicleId,
  plate,
  brandModel,
  driverName,
  nextServiceDate,
  isSelected,
  checked,
  onToggleChecked,
  onContextMenu,
}: {
  vehicleId: string;
  plate: string;
  brandModel: string;
  driverName: string | null;
  nextServiceDate: string | null;
  isSelected: boolean;
  checked: boolean;
  onToggleChecked: () => void;
  onContextMenu: (vehicleId: string, x: number, y: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<VehicleQuickStatus | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    fetch(`/api/vozila/${vehicleId}/status`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<VehicleQuickStatus>;
      })
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {
        if (!cancelled) setDetailError("Podatkov trenutno ni mogoče prikazati.");
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, vehicleId]);

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    onContextMenu(vehicleId, e.clientX, e.clientY);
  }

  return (
    <>
      <tr
        onContextMenu={handleContextMenu}
        onDoubleClick={() => setExpanded((v) => !v)}
        title="Klik za prikaz na zemljevidu, desni klik za zgodovino vožnje, dvoklik za hitre podatke"
        className={isSelected ? "bg-blue-50 dark:bg-blue-950" : undefined}
      >
        <td
          colSpan={2}
          onClick={onToggleChecked}
          role="checkbox"
          aria-checked={checked}
          aria-label={`Prikaži ${plate} na zemljevidu`}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onToggleChecked();
            }
          }}
          className={
            checked
              ? "cursor-pointer px-3 py-2 text-sm bg-green-100 dark:bg-green-900"
              : "cursor-pointer px-3 py-2 text-sm"
          }
        >
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {plate}
            {driverName && <span className="font-normal text-gray-500 dark:text-gray-400"> ({driverName})</span>}
          </span>
          <div className="text-xs text-gray-500 dark:text-gray-400">{brandModel}</div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={2} className="bg-gray-50 px-3 py-2 text-xs dark:bg-gray-800">
            {detailError && <p className="text-red-600 dark:text-red-400">{detailError}</p>}
            {!detail && !detailError && <p className="text-gray-500 dark:text-gray-400">Nalagam …</p>}
            {detail && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Zadnja pozicija: </span>
                  {new Date(detail.fixTime).toLocaleString("sl-SI", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">{STATUS_LABEL[detail.status]}</span>
                  {formatDuration(detail.stateDurationMin)}
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Znamka/model: </span>
                  {brandModel}
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Ignition: </span>
                  {detail.ignition === null ? "—" : detail.ignition ? "Da" : "Ne"}
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Odometer: </span>
                  {detail.odometer ?? "—"}
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Gorivo: </span>
                  {detail.fuel != null ? `${detail.fuel}%` : "—"}
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Naslednji servis: </span>
                  {nextServiceDate ? new Date(nextServiceDate).toLocaleDateString("sl-SI") : "—"}
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
