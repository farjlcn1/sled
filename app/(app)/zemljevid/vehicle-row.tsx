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

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("sl-SI") : "—";
}

export function VehicleRow({
  vehicleId,
  plate,
  brandModel,
  driverName,
  year,
  registrationDate,
  nextServiceDate,
  note,
  tenantName,
  isPlatformAdmin,
  isSelected,
  checked,
  onToggleChecked,
  onContextMenu,
  onLoadHistory,
}: {
  vehicleId: string;
  plate: string;
  brandModel: string;
  driverName: string | null;
  year: number | null;
  registrationDate: string | null;
  nextServiceDate: string | null;
  note: string | null;
  tenantName: string | null;
  isPlatformAdmin: boolean;
  isSelected: boolean;
  checked: boolean;
  onToggleChecked: () => void;
  onContextMenu: (vehicleId: string, x: number, y: number) => void;
  onLoadHistory: (vehicleId: string, label: string) => void;
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
        onMouseDown={(e) => {
          if (e.detail > 1) e.preventDefault();
        }}
        title="Klik za prikaz na zemljevidu, desni klik za zgodovino vožnje, dvoklik za podatke o vozilu"
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
          className={[
            "cursor-pointer px-3 py-2 text-sm",
            checked ? "bg-green-100 dark:bg-green-900" : expanded ? "bg-blue-50/60 dark:bg-blue-950/40" : "",
            expanded ? "border-l-4 border-blue-500 dark:border-blue-400" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <span
            className={
              expanded ? "font-bold text-blue-700 dark:text-blue-400" : "font-medium text-gray-900 dark:text-gray-100"
            }
          >
            {plate}
            {driverName && <span className="font-normal text-gray-500 dark:text-gray-400"> ({driverName})</span>}
          </span>
          <div className="text-xs text-gray-500 dark:text-gray-400">{brandModel}</div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={2} className="border-l-4 border-blue-500 bg-blue-50/60 px-3 py-2 dark:border-blue-400 dark:bg-blue-950/40">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 text-xs">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Registrska: </span>
                  <span className="text-gray-900 dark:text-gray-100">{plate}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Znamka/model: </span>
                  <span className="text-gray-900 dark:text-gray-100">{brandModel}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Letnik: </span>
                  <span className="text-gray-900 dark:text-gray-100">{year ?? "—"}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Voznik: </span>
                  <span className="text-gray-900 dark:text-gray-100">{driverName ?? "—"}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Datum registracije: </span>
                  <span className="text-gray-900 dark:text-gray-100">{fmtDate(registrationDate)}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Naslednji servis: </span>
                  <span className="text-gray-900 dark:text-gray-100">{fmtDate(nextServiceDate)}</span>
                </div>
                {isPlatformAdmin && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Podjetje: </span>
                    <span className="text-gray-900 dark:text-gray-100">{tenantName}</span>
                  </div>
                )}
                {note && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Opomba: </span>
                    <span className="text-gray-900 dark:text-gray-100">{note}</span>
                  </div>
                )}

                {detailError && <p className="text-red-600 dark:text-red-400">{detailError}</p>}
                {!detail && !detailError && <p className="text-gray-500 dark:text-gray-400">Nalagam …</p>}
                {detail && (
                  <>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Zadnja pozicija: </span>
                      <span className="text-gray-900 dark:text-gray-100">
                        {new Date(detail.fixTime).toLocaleString("sl-SI", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">{STATUS_LABEL[detail.status]}</span>
                      <span className="text-gray-900 dark:text-gray-100">
                        {formatDuration(detail.stateDurationMin)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Ignition: </span>
                      <span className="text-gray-900 dark:text-gray-100">
                        {detail.ignition === null ? "—" : detail.ignition ? "Da" : "Ne"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Odometer: </span>
                      <span className="text-gray-900 dark:text-gray-100">{detail.odometer ?? "—"}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Gorivo: </span>
                      <span className="text-gray-900 dark:text-gray-100">
                        {detail.fuel != null ? `${detail.fuel}%` : "—"}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => onLoadHistory(vehicleId, plate)}
                className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium whitespace-nowrap text-white"
              >
                Naloži zgodovino
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
