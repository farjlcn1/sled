"use client";

import { useState, useTransition } from "react";
import { setVehicleSubscription, setVehicleBilling, bulkSetVehicleBilling } from "./actions";

export type BillableVehicleRow = {
  id: string;
  plate: string;
  deviceImei: string | null;
  subscriptionId: string | null;
  billingEnabled: boolean;
};

export function VehiclesBillingTable({
  vehicles,
  plans,
}: {
  vehicles: BillableVehicleRow[];
  plans: { id: string; name: string }[];
}) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [isPending, startTransition] = useTransition();
  const [pendingRowId, setPendingRowId] = useState<string | null>(null);

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

  function handleBulk(enabled: boolean) {
    if (checked.size === 0) return;
    startTransition(async () => {
      await bulkSetVehicleBilling(Array.from(checked), enabled);
      setChecked(new Set());
    });
  }

  function handlePackageChange(vehicleId: string, subscriptionId: string) {
    setPendingRowId(vehicleId);
    startTransition(async () => {
      await setVehicleSubscription(vehicleId, subscriptionId || null);
      setPendingRowId(null);
    });
  }

  function handleBillingChange(vehicleId: string, enabled: boolean) {
    setPendingRowId(vehicleId);
    startTransition(async () => {
      await setVehicleBilling(vehicleId, enabled);
      setPendingRowId(null);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Vozila</h2>
        <button
          type="button"
          onClick={() => handleBulk(true)}
          disabled={checked.size === 0 || isPending}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          Omogoči zaračunavanje
        </button>
        <button
          type="button"
          onClick={() => handleBulk(false)}
          disabled={checked.size === 0 || isPending}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300"
        >
          Onemogoči zaračunavanje
        </button>
        {checked.size > 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-400">Izbranih: {checked.size}</span>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="w-8 px-3 py-2">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Odkljukaj vse" />
              </th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Registrska</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">IMEI</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Paket</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                Zaračunavanje
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {vehicles.map((v) => (
              <tr key={v.id}>
                <td className="px-3 py-2">
                  <input type="checkbox" checked={checked.has(v.id)} onChange={() => toggleOne(v.id)} />
                </td>
                <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">{v.plate}</td>
                <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{v.deviceImei ?? "—"}</td>
                <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                  <select
                    value={v.subscriptionId ?? ""}
                    onChange={(e) => handlePackageChange(v.id, e.target.value)}
                    disabled={pendingRowId === v.id}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="">— brez paketa —</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={v.billingEnabled}
                    disabled={pendingRowId === v.id}
                    onChange={(e) => handleBillingChange(v.id, e.target.checked)}
                  />
                </td>
              </tr>
            ))}
            {vehicles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  To podjetje nima vozil.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
