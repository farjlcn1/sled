"use client";

import { useMemo, useState, useTransition } from "react";
import { deleteVehicles } from "./actions";
import { EditVehicleForm } from "./edit-vehicle-form";

const ICON_LABELS: Record<string, string> = {
  CAR: "Osebno vozilo",
  VAN: "Kombi",
  TRUCK: "Kamion",
  EXCAVATOR: "Bager",
  TRACTOR: "Traktor",
  MOTORCYCLE: "Motor",
};

export type VehicleRow = {
  id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  icon: string;
  fuelTankVolumeL: number | null;
  note: string | null;
  deviceId: string | null;
  deviceImei: string | null;
  deviceProtocol: string | null;
  deviceBrand: string | null;
  deviceModel: string | null;
  registrationDate: string | null;
  nextServiceDate: string | null;
  nextServiceKm: number | null;
  driverName: string | null;
  groupNames: string[];
};

type SortDir = "asc" | "desc";
type ColumnKey = "plate" | "brandModel" | "year" | "icon" | "fuelTankVolumeL" | "deviceImei" | "groups" | "driver" | "note";

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "plate", label: "Registrska" },
  { key: "brandModel", label: "Znamka/model" },
  { key: "year", label: "Letnik" },
  { key: "icon", label: "Ikona" },
  { key: "fuelTankVolumeL", label: "Rezervoar (L)" },
  { key: "deviceImei", label: "Naprava" },
  { key: "groups", label: "Skupina" },
  { key: "driver", label: "Voznik" },
  { key: "note", label: "Komentar" },
];

function sortValue(v: VehicleRow, key: ColumnKey): string | number {
  switch (key) {
    case "plate":
      return v.plate;
    case "brandModel":
      return [v.brand, v.model].filter(Boolean).join(" ");
    case "year":
      return v.year ?? -Infinity;
    case "icon":
      return ICON_LABELS[v.icon] ?? v.icon;
    case "fuelTankVolumeL":
      return v.fuelTankVolumeL ?? -Infinity;
    case "deviceImei":
      return v.deviceImei ?? "";
    case "groups":
      return v.groupNames.join(", ");
    case "driver":
      return v.driverName ?? "";
    case "note":
      return v.note ?? "";
  }
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "sl-SI", { numeric: true });
}

export type AvailableDevice = { id: string; imei: string; protocol: string; brand: string | null; model: string | null };

export function VehiclesTable({
  vehicles,
  availableDevices,
  canBulkDelete,
}: {
  vehicles: VehicleRow[];
  availableDevices: AvailableDevice[];
  canBulkDelete: boolean;
}) {
  const [sort, setSort] = useState<{ key: ColumnKey; dir: SortDir } | null>(null);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sortedVehicles = useMemo(() => {
    if (!sort) return vehicles;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...vehicles].sort((a, b) => factor * compare(sortValue(a, sort.key), sortValue(b, sort.key)));
  }, [vehicles, sort]);

  function handleSort(key: ColumnKey) {
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function sortIndicator(key: ColumnKey) {
    if (sort?.key !== key) return "";
    return sort.dir === "asc" ? " ▲" : " ▼";
  }

  const allChecked = vehicles.length > 0 && vehicles.every((v) => checked.has(v.id));
  function toggleAll() {
    setChecked(allChecked ? new Set() : new Set(vehicles.map((v) => v.id)));
  }
  function toggleOne(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDeleteClick() {
    if (checked.size === 0) return;
    const count = checked.size;
    const ok = window.confirm(`Ali res želiš izbrisati ${count} vozil${count === 1 ? "o" : "a"}?`);
    if (!ok) return;

    startTransition(async () => {
      const result = await deleteVehicles(Array.from(checked));
      if (!result) return;
      if (result.error) {
        setDeleteMessage(result.error);
      } else {
        const parts: string[] = [];
        if (result.deleted) parts.push(`Izbrisanih: ${result.deleted}.`);
        if (result.failed?.length) parts.push(`Ni bilo mogoče izbrisati: ${result.failed.join(", ")}.`);
        setDeleteMessage(parts.join(" "));
      }
      setChecked(new Set());
    });
  }

  const editingVehicle = editingId ? vehicles.find((v) => v.id === editingId) ?? null : null;
  const editingDeviceOptions = editingVehicle
    ? [
        ...availableDevices,
        // Trenutno dodeljena naprava ne bo v availableDevices (tisti seznam vsebuje samo proste
        // naprave, glej vozila/page.tsx) -- brez tega bi bila možnost izbire prazna/manjkajoča.
        ...(editingVehicle.deviceId && !availableDevices.some((d) => d.id === editingVehicle.deviceId)
          ? [
              {
                id: editingVehicle.deviceId,
                imei: editingVehicle.deviceImei ?? editingVehicle.deviceId,
                protocol: editingVehicle.deviceProtocol ?? "OTHER",
                brand: editingVehicle.deviceBrand,
                model: editingVehicle.deviceModel,
              },
            ]
          : []),
      ]
    : availableDevices;

  return (
    <div className="space-y-3">
      {canBulkDelete && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleDeleteClick}
            disabled={checked.size === 0 || isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPending ? "Brišem …" : "Izbriši vozilo"}
          </button>
          {checked.size > 0 && (
            <span className="text-sm text-gray-500 dark:text-gray-400">Izbranih: {checked.size}</span>
          )}
          {deleteMessage && <span className="text-sm text-gray-700 dark:text-gray-300">{deleteMessage}</span>}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {canBulkDelete && (
                <th className="w-8 px-3 py-2">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Odkljukaj vse" />
                </th>
              )}
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="cursor-pointer select-none px-3 py-2 text-left text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {col.label}
                  {sortIndicator(col.key)}
                </th>
              ))}
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {sortedVehicles.map((v) => (
              <tr key={v.id}>
                {canBulkDelete && (
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={checked.has(v.id)} onChange={() => toggleOne(v.id)} />
                  </td>
                )}
                <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">{v.plate}</td>
                <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                  {[v.brand, v.model].filter(Boolean).join(" ") || "—"}
                </td>
                <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{v.year ?? "—"}</td>
                <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{ICON_LABELS[v.icon]}</td>
                <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{v.fuelTankVolumeL ?? "—"}</td>
                <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{v.deviceImei ?? "—"}</td>
                <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                  {v.groupNames.join(", ") || "—"}
                </td>
                <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{v.driverName ?? "—"}</td>
                <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{v.note ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => setEditingId(v.id)}
                    className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    Uredi
                  </button>
                </td>
              </tr>
            ))}
            {vehicles.length === 0 && (
              <tr>
                <td
                  colSpan={COLUMNS.length + 1 + (canBulkDelete ? 1 : 0)}
                  className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  Ni še vozil.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingVehicle && (
        <EditVehicleForm
          vehicle={editingVehicle}
          availableDevices={editingDeviceOptions}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}
