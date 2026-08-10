"use client";

import { useActionState, useState } from "react";
import { createPotniNalog } from "./actions";

const inputClass =
  "mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";

export function NalogForm({
  vehicles,
  drivers,
}: {
  vehicles: { id: string; plate: string }[];
  drivers: { id: string; fullName: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createPotniNalog, undefined);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
      >
        Nov potni nalog
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-md border border-gray-200 p-4 dark:border-gray-700">
      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Nov potni nalog — odredba</h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Vozilo</label>
          <select name="vehicleId" required className={inputClass}>
            <option value="">— izberi vozilo —</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Voznik</label>
          <select name="driverId" className={inputClass}>
            <option value="">— brez —</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Odredbodajalec (ime in funkcija)</label>
          <input name="issuedByName" required className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Namen poti</label>
          <input name="purpose" required placeholder="npr. sestanek s stranko X, dostava blaga" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Kraj odhoda</label>
          <input name="plannedFrom" required className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cilj</label>
          <input name="plannedTo" required className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Vmesne postaje (neobvezno)</label>
          <input name="plannedVia" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Planiran odhod</label>
          <input type="datetime-local" name="plannedDepartureAt" required className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Planirana vrnitev</label>
          <input type="datetime-local" name="plannedReturnAt" required className={inputClass} />
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-700 dark:text-green-400">Potni nalog ustvarjen.</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300"
        >
          Prekliči
        </button>
        <button type="submit" disabled={pending} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {pending ? "Ustvarjam …" : "Ustvari"}
        </button>
      </div>
    </form>
  );
}
