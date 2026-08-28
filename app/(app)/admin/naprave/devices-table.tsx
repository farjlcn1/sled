"use client";

import { useMemo, useState } from "react";
import { DeleteDeviceButton } from "./delete-device-button";
import { AssignTenantSelect } from "./assign-tenant-select";
import { EditDeviceForm } from "./edit-device-form";
import { PROTOCOL_OPTIONS } from "./protocol-options";
import { SmsDevicesForm } from "./sms-devices-form";

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
  vehicleYear: number | null;
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
  | "vehicleYear"
  | "note";

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "imei", label: "IMEI" },
  { key: "brandModel", label: "Znamka/model" },
  { key: "serialNumber", label: "Serijska št." },
  { key: "simNumber", label: "SIM" },
  { key: "protocol", label: "Protokol" },
  { key: "tenant", label: "Podjetje" },
  { key: "vehicle", label: "Vozilo" },
  { key: "vehicleYear", label: "Letnik vozila" },
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
    case "vehicleYear":
      return d.vehicleYear ?? -Infinity;
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
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [smsOpen, setSmsOpen] = useState(false);
  const [smsMessage, setSmsMessage] = useState<string | null>(null);

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

  const allChecked = devices.length > 0 && devices.every((d) => checked.has(d.id));
  function toggleAll() {
    setChecked(allChecked ? new Set() : new Set(devices.map((d) => d.id)));
  }
  function toggleOne(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const editingDevice = editingId ? devices.find((d) => d.id === editingId) ?? null : null;
  const smsDevices = devices.filter((d) => checked.has(d.id));

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {checked.size > 0 && (
              <span className="text-sm text-gray-500 dark:text-gray-400">Izbranih: {checked.size}</span>
            )}
            {smsMessage && <span className="text-sm text-gray-700 dark:text-gray-300">{smsMessage}</span>}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSmsOpen(true)}
              disabled={checked.size === 0}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              SMS
            </button>
            <a href="/api/naprave/izvoz" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
              Izvoz
            </a>
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="w-8 px-3 py-2">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Odkljukaj vse" />
                </th>
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
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={checked.has(d.id)} onChange={() => toggleOne(d.id)} />
                  </td>
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
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{d.vehicleYear ?? "—"}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{d.note ?? ""}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={`/admin/naprave/${d.id}/surovi-podatki`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        Surovi podatki
                      </a>
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
                  <td colSpan={COLUMNS.length + 2} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    Ni še naprav.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingDevice && <EditDeviceForm device={editingDevice} onClose={() => setEditingId(null)} />}

      {smsOpen && (
        <SmsDevicesForm
          devices={smsDevices}
          onClose={() => setSmsOpen(false)}
          onSent={({ sent, failed }) => {
            setSmsMessage(
              failed === 0
                ? `SMS uspešno poslan na ${sent} naprav${sent === 1 ? "o" : "e"}.`
                : `SMS poslan na ${sent} naprav${sent === 1 ? "o" : "e"}, ${failed} neuspešn${failed === 1 ? "a" : "ih"}.`
            );
            setChecked(new Set());
            setSmsOpen(false);
          }}
        />
      )}
    </>
  );
}
