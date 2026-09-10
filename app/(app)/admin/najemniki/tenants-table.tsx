"use client";

import { useMemo, useState } from "react";
import { EditTenantForm } from "./edit-tenant-form";

const STATUS_LABELS: Record<string, string> = {
  AKTIVEN: "Aktiven",
  NEAKTIVEN: "Neaktiven",
  TEST: "Test",
  V_ODPOVEDI: "V odpovedi",
};

export type TenantRow = {
  id: string;
  name: string;
  deviceLimit: number;
  status: string;
  planIds: string[];
  planNames: string[];
  vehicleCount: number;
  deviceCount: number;
  userCount: number;
};

type SortDir = "asc" | "desc";
type ColumnKey = "name" | "planNames" | "deviceLimit" | "vehicleCount" | "deviceCount" | "userCount" | "status";

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "name", label: "Ime" },
  { key: "planNames", label: "Paketi" },
  { key: "deviceLimit", label: "Meja naprav" },
  { key: "vehicleCount", label: "Vozila" },
  { key: "deviceCount", label: "Naprave" },
  { key: "userCount", label: "Uporabniki" },
  { key: "status", label: "Status" },
];

function sortValue(t: TenantRow, key: ColumnKey): string | number {
  switch (key) {
    case "name":
      return t.name;
    case "planNames":
      return t.planNames.join(", ");
    case "deviceLimit":
      return t.deviceLimit;
    case "vehicleCount":
      return t.vehicleCount;
    case "deviceCount":
      return t.deviceCount;
    case "userCount":
      return t.userCount;
    case "status":
      return STATUS_LABELS[t.status] ?? t.status;
  }
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "sl-SI", { numeric: true });
}

export function TenantsTable({
  tenants,
  plans,
}: {
  tenants: TenantRow[];
  plans: { id: string; name: string }[];
}) {
  const [sort, setSort] = useState<{ key: ColumnKey; dir: SortDir } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const sortedTenants = useMemo(() => {
    if (!sort) return tenants;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...tenants].sort((a, b) => factor * compare(sortValue(a, sort.key), sortValue(b, sort.key)));
  }, [tenants, sort]);

  function handleSort(key: ColumnKey) {
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function sortIndicator(key: ColumnKey) {
    if (sort?.key !== key) return "";
    return sort.dir === "asc" ? " ▲" : " ▼";
  }

  const editingTenant = editingId ? tenants.find((t) => t.id === editingId) ?? null : null;

  return (
    <div className="space-y-3">
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
            {sortedTenants.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{t.name}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                  {t.planNames.length > 0 ? t.planNames.join(", ") : "—"}
                </td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{t.deviceLimit}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{t.vehicleCount}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{t.deviceCount}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{t.userCount}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                  {STATUS_LABELS[t.status] ?? t.status}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => setEditingId(t.id)}
                    className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    Uredi
                  </button>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  Ni še podjetij.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingTenant && (
        <EditTenantForm
          tenant={{
            id: editingTenant.id,
            name: editingTenant.name,
            deviceLimit: editingTenant.deviceLimit,
            status: editingTenant.status,
            planIds: editingTenant.planIds,
          }}
          plans={plans}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}
