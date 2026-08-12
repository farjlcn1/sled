"use client";

import { useMemo, useState } from "react";
import { DeleteDeviceButton } from "./delete-device-button";
import { AssignTenantSelect } from "./assign-tenant-select";
import { EditDeviceForm, PROTOCOL_OPTIONS } from "./edit-device-form";

const PROTOCOL_LABELS: Record<string, string> = Object.fromEntries(
  PROTOCOL_OPTIONS.map((o) => [o.value, o.label])
);

export type DeviceRow = {
  id: string;
  imei: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  simNumber: string | null;
  protocol: string;
  note: string | null;
  tenantId: string | null;
  tenantName: string | null;
  vehiclePlate: string | null;
};

type SortDir = "asc" | "desc";
type ColumnKey =
  | "imei"
  | "brandModel"
  | "serialNumber"
  | "simNumber"
  | "protocol"
  | "tenant"
  | "vehicle"
  | "note";

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "imei", label: "IMEI" },
  { key: "brandModel", label: "Znamka/model" },
  { key: "serialNumber", label: "Serijska št." },
  { key: "simNumber", label: "SIM" },
  { key: "protocol", label: "Protokol" },
  { key: "tenant", label: "Podjetje" },
  { key: "vehicle", label: "Vozilo" },
  { key: "note", label: "Opomba" },
];

function sortValue(d: DeviceRow, key: ColumnKey): string | number {
  switch (key) {
    case "imei":
      return d.imei;
    case "brandModel":
      return [d.brand, d.model].filter(Boolean).join(" ");
    case "serialNumber":
      return d.serialNumber ?? "";
    case "simNumber":
      return d.simNumber ?? "";
    case "protocol":
      return PROTOCOL_LABELS[d.protocol] ?? d.protocol;
    case "tenant":
      return d.tenantName ?? "";
    case "vehicle":
      return d.vehiclePlate ?? "";
    case "note":
      return d.note ?? "";
  }
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "sl-SI", { numeric: true });
}

export function DevicesTable({
  devices,
  tenants,
}: {
  devices: DeviceRow[];
  tenants: { id: string; name: string }[];
}) {
  const [sort, setSort] = useState<{ key: ColumnKey; dir: SortDir } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const sortedDevices = useMemo(() => {
    if (!sort) return devices;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...devices].sort((a, b) => factor * compare(sortValue(a, sort.key), sortValue(b, sort.key)));
  }, [devices, sort]);

  function handleSort(key: ColumnKey) {
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function sortIndicator(key: ColumnKey) {
    if (sort?.key !== key) return "";
    return sort.dir === "asc" ? " ▲" : " ▼";
  }

  const editingDevice = editingId ? devices.find((d) => d.id === editingId) ?? null : null;

  return (
    <>
      <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="cursor-pointer select-none px-4 py-2 text-left text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {col.label}
                  {sortIndicator(col.key)}
                </th>
              ))}
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {sortedDevices.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{d.imei}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                  {[d.brand, d.model].filter(Boolean).join(" ") || "—"}
                </td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{d.serialNumber ?? "—"}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{d.simNumber ?? "—"}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                  {PROTOCOL_LABELS[d.protocol] ?? d.protocol}
                </td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                  <AssignTenantSelect deviceId={d.id} currentTenantId={d.tenantId} tenants={tenants} />
                </td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                  {d.vehiclePlate ?? <span className="text-gray-400">nedodeljeno</span>}
                </td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{d.note ?? ""}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(d.id)}
                      className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      Uredi
                    </button>
                    <DeleteDeviceButton id={d.id} />
                  </div>
                </td>
              </tr>
            ))}
            {devices.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  Ni še naprav.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingDevice && <EditDeviceForm device={editingDevice} onClose={() => setEditingId(null)} />}
    </>
  );
}
