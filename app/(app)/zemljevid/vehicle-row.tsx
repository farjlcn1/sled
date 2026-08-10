"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { VehicleQuickStatus } from "@/app/api/vozila/[id]/status/route";

function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function defaultTo() {
  return new Date().toISOString().slice(0, 10);
}

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
}: {
  vehicleId: string;
  plate: string;
  brandModel: string;
  driverName: string | null;
  nextServiceDate: string | null;
  isSelected: boolean;
  checked: boolean;
  onToggleChecked: () => void;
}) {
  const router = useRouter();
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<VehicleQuickStatus | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    if (!menuPos) return;
    function close() {
      setMenuPos(null);
    }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuPos]);

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
    setMenuPos({ x: e.clientX, y: e.clientY });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const from = formData.get("from") as string;
    const to = formData.get("to") as string;
    setDialogOpen(false);
    router.push(`/zemljevid?vozilo=${vehicleId}&from=${from}&to=${to}`);
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

          {menuPos && (
            <div
              className="fixed z-20 rounded-md border border-gray-300 bg-white py-1 text-sm shadow-lg dark:border-gray-600 dark:bg-gray-800"
              style={{ left: menuPos.x, top: menuPos.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="block w-full whitespace-nowrap px-3 py-1.5 text-left text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={() => {
                  setMenuPos(null);
                  setDialogOpen(true);
                }}
              >
                Naloži zgodovino
              </button>
            </div>
          )}

          {dialogOpen && (
            <div
              className="fixed inset-0 z-30 flex items-center justify-center bg-black/30"
              onClick={() => setDialogOpen(false)}
            >
              <form
                onClick={(e) => e.stopPropagation()}
                onSubmit={handleSubmit}
                className="space-y-3 rounded-md border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900"
              >
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Zgodovina — {plate}</h3>
                <div className="flex gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Od</label>
                    <input
                      type="date"
                      name="from"
                      defaultValue={defaultFrom()}
                      required
                      className="mt-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Do</label>
                    <input
                      type="date"
                      name="to"
                      defaultValue={defaultTo()}
                      required
                      className="mt-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDialogOpen(false)}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300"
                  >
                    Prekliči
                  </button>
                  <button type="submit" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white">
                    Naloži
                  </button>
                </div>
              </form>
            </div>
          )}
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
