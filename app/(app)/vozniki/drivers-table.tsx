"use client";

import { useMemo, useState, useTransition } from "react";
import { deleteDrivers } from "./actions";
import { EditDriverForm } from "./edit-driver-form";
import { AssignVehicleSelect } from "./assign-vehicle-select";

const ID_METHOD_LABELS: Record<string, string> = {
  IBUTTON: "iButton",
  RFID: "RFID",
  MANUAL: "Ročno",
};

export type DriverRow = {
  id: string;
  fullName: string;
  tenantName: string;
  phone: string | null;
  licenseNumber: string | null;
  idMethod: string;
  idCode: string | null;
  currentVehicleId: string | null;
  currentVehiclePlate: string | null;
};

type SortDir = "asc" | "desc";
type ColumnKey = "fullName" | "tenantName" | "phone" | "licenseNumber" | "idMethod" | "idCode" | "vehicle";

function sortValue(d: DriverRow, key: ColumnKey): string {
  switch (key) {
    case "fullName":
      return d.fullName;
    case "tenantName":
      return d.tenantName;
    case "phone":
      return d.phone ?? "";
    case "licenseNumber":
      return d.licenseNumber ?? "";
    case "idMethod":
      return ID_METHOD_LABELS[d.idMethod] ?? d.idMethod;
    case "idCode":
      return d.idCode ?? "";
    case "vehicle":
      return d.currentVehiclePlate ?? "";
  }
}

function compare(a: string, b: string): number {
  return a.localeCompare(b, "sl-SI", { numeric: true });
}

export function DriversTable({
  drivers,
  vehicles,
  showTenantColumn,
  canAssignVehicle,
  canEdit,
  canBulkDelete,
}: {
  drivers: DriverRow[];
  vehicles: { id: string; plate: string }[];
  showTenantColumn: boolean;
  canAssignVehicle: boolean;
  canEdit: boolean;
  canBulkDelete: boolean;
}) {
  const columns = useMemo(() => {
    const base: { key: ColumnKey; label: string }[] = [{ key: "fullName", label: "Ime" }];
    if (showTenantColumn) base.push({ key: "tenantName", label: "Podjetje" });
    base.push(
      { key: "phone", label: "Telefon" },
      { key: "licenseNumber", label: "Vozniško dovoljenje" },
      { key: "idMethod", label: "ID način" },
      { key: "idCode", label: "ID koda" },
      { key: "vehicle", label: "Trenutno vozilo" }
    );
    return base;
  }, [showTenantColumn]);

  const [sort, setSort] = useState<{ key: ColumnKey; dir: SortDir } | null>(null);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sortedDrivers = useMemo(() => {
    if (!sort) return drivers;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...drivers].sort((a, b) => factor * compare(sortValue(a, sort.key), sortValue(b, sort.key)));
  }, [drivers, sort]);

  function handleSort(key: ColumnKey) {
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function sortIndicator(key: ColumnKey) {
    if (sort?.key !== key) return "";
    return sort.dir === "asc" ? " ▲" : " ▼";
  }

  const allChecked = drivers.length > 0 && drivers.every((d) => checked.has(d.id));
  function toggleAll() {
    setChecked(allChecked ? new Set() : new Set(drivers.map((d) => d.id)));
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
    const ok = window.confirm(`Ali res želiš izbrisati ${count} voznik${count === 1 ? "a" : "ov"}?`);
    if (!ok) return;

    startTransition(async () => {
      const result = await deleteDrivers(Array.from(checked));
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

  const editingDriver = editingId ? drivers.find((d) => d.id === editingId) ?? null : null;

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
            {isPending ? "Brišem …" : "Izbriši voznika"}
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
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="cursor-pointer select-none px-4 py-2 text-left text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {col.label}
                  {sortIndicator(col.key)}
                </th>
              ))}
              {canEdit && <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {sortedDrivers.map((d) => (
              <tr key={d.id}>
                {canBulkDelete && (
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={checked.has(d.id)} onChange={() => toggleOne(d.id)} />
                  </td>
                )}
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{d.fullName}</td>
                {showTenantColumn && (
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{d.tenantName}</td>
                )}
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{d.phone ?? "—"}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{d.licenseNumber ?? "—"}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{ID_METHOD_LABELS[d.idMethod]}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                  <code className="text-xs">{d.idCode ?? "—"}</code>
                </td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                  {canAssignVehicle ? (
                    <AssignVehicleSelect driverId={d.id} currentVehicleId={d.currentVehicleId} vehicles={vehicles} />
                  ) : (
                    d.currentVehiclePlate ?? "—"
                  )}
                </td>
                {canEdit && (
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setEditingId(d.id)}
                      className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      Uredi
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {drivers.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + (canBulkDelete ? 1 : 0) + (canEdit ? 1 : 0)}
                  className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  Ni še voznikov.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingDriver && <EditDriverForm driver={editingDriver} onClose={() => setEditingId(null)} />}
    </div>
  );
}
