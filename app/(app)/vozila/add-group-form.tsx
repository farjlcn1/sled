"use client";

import { useActionState } from "react";
import { createVehicleGroup } from "./actions";

export function AddGroupForm({ tenantId }: { tenantId?: string }) {
  const [state, formAction, pending] = useActionState(createVehicleGroup, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {tenantId && <input type="hidden" name="tenantId" value={tenantId} />}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nova skupina vozil</label>
        <input
          name="name"
          required
          placeholder="npr. Dostavna vozila"
          className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Dodajam …" : "Dodaj skupino"}
      </button>
      {state?.error && <p className="w-full text-sm text-red-600 dark:text-red-400">{state.error}</p>}
    </form>
  );
}
