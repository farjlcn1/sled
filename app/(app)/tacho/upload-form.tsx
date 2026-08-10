"use client";

import { useActionState, useState } from "react";
import { uploadTachoFile } from "./actions";

const inputClass =
  "mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";

export function UploadForm({
  vehicles,
  drivers,
}: {
  vehicles: { id: string; plate: string }[];
  drivers: { id: string; fullName: string }[];
}) {
  const [state, formAction, pending] = useActionState(uploadTachoFile, undefined);
  const [kind, setKind] = useState<"VOZILO" | "VOZNIK">("VOZILO");

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-md border border-gray-200 p-4 dark:border-gray-700">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tip</label>
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as "VOZILO" | "VOZNIK")} className={inputClass}>
          <option value="VOZILO">Vozilo (VU)</option>
          <option value="VOZNIK">Voznik (kartica)</option>
        </select>
      </div>
      {kind === "VOZILO" ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Vozilo</label>
          <select name="vehicleId" required className={inputClass}>
            <option value="">— izberi —</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Voznik</label>
          <select name="driverId" required className={inputClass}>
            <option value="">— izberi —</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Datoteka (.ddd)</label>
        <input type="file" name="file" required className={inputClass} />
      </div>
      <button type="submit" disabled={pending} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {pending ? "Nalagam …" : "Naloži"}
      </button>
      {state?.error && <p className="w-full text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {state?.success && <p className="w-full text-sm text-green-700 dark:text-green-400">Datoteka naložena.</p>}
    </form>
  );
}
