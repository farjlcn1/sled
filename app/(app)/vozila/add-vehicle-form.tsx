"use client";

import { useActionState } from "react";
import { createVehicle } from "./actions";

const ICON_OPTIONS: { value: string; label: string }[] = [
  { value: "CAR", label: "Osebno vozilo" },
  { value: "VAN", label: "Kombi" },
  { value: "TRUCK", label: "Kamion" },
  { value: "EXCAVATOR", label: "Bager" },
  { value: "TRACTOR", label: "Traktor" },
  { value: "MOTORCYCLE", label: "Motor" },
];

export function AddVehicleForm({
  availableDevices,
  groups,
  tenantId,
}: {
  availableDevices: { id: string; imei: string }[];
  groups: { id: string; name: string }[];
  tenantId?: string;
}) {
  const [state, formAction, pending] = useActionState(createVehicle, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-md border border-gray-200 p-4 dark:border-gray-700">
      {tenantId && <input type="hidden" name="tenantId" value={tenantId} />}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Registrska št.</label>
        <input
          name="plate"
          required
          className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Znamka</label>
        <input
          name="brand"
          className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Model</label>
        <input
          name="model"
          className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Letnik</label>
        <input
          name="year"
          type="number"
          className="mt-1 w-24 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Ikona</label>
        <select
          name="icon"
          defaultValue="CAR"
          className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          {ICON_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Volumen rezervoarja (L)</label>
        <input
          name="fuelTankVolumeL"
          type="number"
          step="0.1"
          min="0"
          className="mt-1 w-28 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Naprava (IMEI)</label>
        <select
          name="deviceId"
          className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">— brez naprave —</option>
          {availableDevices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.imei}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Skupina</label>
        <select
          name="groupId"
          className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">— brez skupine —</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      <div className="w-full">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Komentar</label>
        <input
          name="note"
          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Dodajam …" : "Dodaj vozilo"}
      </button>
      {state?.error && <p className="w-full text-sm text-red-600 dark:text-red-400">{state.error}</p>}
    </form>
  );
}
