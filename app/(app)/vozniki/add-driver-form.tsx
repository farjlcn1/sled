"use client";

import { useActionState } from "react";
import { createDriver } from "./actions";

export function AddDriverForm() {
  const [state, formAction, pending] = useActionState(createDriver, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-md border border-gray-200 p-4 dark:border-gray-700">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Ime in priimek</label>
        <input
          name="fullName"
          required
          className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Telefon</label>
        <input
          name="phone"
          className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Št. vozniškega dovoljenja</label>
        <input
          name="licenseNumber"
          className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Način ID</label>
        <select
          name="idMethod"
          defaultValue="RFID"
          className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="RFID">RFID</option>
          <option value="IBUTTON">iButton</option>
          <option value="MANUAL">Ročno</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">ID koda (RFID/iButton)</label>
        <input
          name="idCode"
          placeholder="neobvezno"
          className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Dodajam …" : "Dodaj voznika"}
      </button>
      {state?.error && <p className="w-full text-sm text-red-600 dark:text-red-400">{state.error}</p>}
    </form>
  );
}
