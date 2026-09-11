"use client";

import { useMemo, useState, useTransition } from "react";
import { saveVehicleBilling } from "./actions";

export type BillableVehicleRow = {
  id: string;
  plate: string;
  deviceImei: string | null;
  simNumber: string | null;
  subscriptionId: string | null;
  billingEnabled: boolean;
};

type EntryState = { subscriptionId: string | null; billingEnabled: boolean };

function buildInitial(vehicles: BillableVehicleRow[]): Record<string, EntryState> {
  const state: Record<string, EntryState> = {};
  for (const v of vehicles) {
    state[v.id] = { subscriptionId: v.subscriptionId, billingEnabled: v.billingEnabled };
  }
  return state;
}

// Spremembe se do klika na "Shrani" hranijo samo lokalno (isti vzorec kot GroupsMatrix v
// skupine/groups-matrix.tsx) -- nič se ne posreduje strežniku, dokler uporabnik ne potrdi.
export function VehiclesBillingTable({
  tenantId,
  vehicles,
  plans,
}: {
  tenantId: string;
  vehicles: BillableVehicleRow[];
  plans: { id: string; name: string }[];
}) {
  const initial = useMemo(() => buildInitial(vehicles), [vehicles]);
  const [entries, setEntries] = useState<Record<string, EntryState>>(initial);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const dirty = useMemo(() => {
    return vehicles.some((v) => {
      const e = entries[v.id];
      return e && (e.subscriptionId !== initial[v.id].subscriptionId || e.billingEnabled !== initial[v.id].billingEnabled);
    });
  }, [entries, initial, vehicles]);

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

  function setEntry(vehicleId: string, patch: Partial<EntryState>) {
    setEntries((prev) => ({ ...prev, [vehicleId]: { ...prev[vehicleId], ...patch } }));
    setMessage(null);
  }

  function handleBulk(enabled: boolean) {
    if (checked.size === 0) return;
    setEntries((prev) => {
      const next = { ...prev };
      for (const id of checked) next[id] = { ...next[id], billingEnabled: enabled };
      return next;
    });
    setChecked(new Set());
    setMessage(null);
  }

  function handleSave() {
    const payload = vehicles.map((v) => ({
      vehicleId: v.id,
      subscriptionId: entries[v.id]?.subscriptionId ?? null,
      billingEnabled: entries[v.id]?.billingEnabled ?? false,
    }));
    startTransition(async () => {
      const result = await saveVehicleBilling(tenantId, payload);
      setMessage(result.error ?? "Spremembe shranjene.");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Vozila</h2>
        <button
          type="button"
          onClick={() => handleBulk(true)}
          disabled={checked.size === 0}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          Omogoči zaračunavanje
        </button>
        <button
          type="button"
          onClick={() => handleBulk(false)}
          disabled={checked.size === 0}
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
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">SIM</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Paket</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                Zaračunavanje
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {vehicles.map((v) => {
              const e = entries[v.id] ?? { subscriptionId: null, billingEnabled: false };
              return (
                <tr key={v.id}>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={checked.has(v.id)} onChange={() => toggleOne(v.id)} />
                  </td>
                  <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">{v.plate}</td>
                  <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{v.deviceImei ?? "—"}</td>
                  <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{v.simNumber ?? "—"}</td>
                  <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                    <select
                      value={e.subscriptionId ?? ""}
                      onChange={(ev) => setEntry(v.id, { subscriptionId: ev.target.value || null })}
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
                    <button
                      type="button"
                      onClick={() => setEntry(v.id, { billingEnabled: !e.billingEnabled })}
                      className={
                        e.billingEnabled
                          ? "rounded-md bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                      }
                    >
                      {e.billingEnabled ? "Da" : "Ne"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {vehicles.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  To podjetje nima vozil.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {vehicles.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            title="Spremembe v zgornji tabeli se shranijo šele s klikom na ta gumb."
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPending ? "Shranjujem …" : "Shrani"}
          </button>
          {dirty && !isPending && (
            <span className="text-sm text-gray-500 dark:text-gray-400">Neshranjene spremembe</span>
          )}
          {message && <span className="text-sm text-gray-700 dark:text-gray-300">{message}</span>}
        </div>
      )}
    </div>
  );
}
