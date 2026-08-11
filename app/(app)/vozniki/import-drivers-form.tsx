"use client";

import { useActionState } from "react";
import { importDriversXlsx } from "./actions";

export function ImportDriversForm() {
  const [state, formAction, pending] = useActionState(importDriversXlsx, undefined);

  return (
    <form action={formAction} className="space-y-3 rounded-md border border-gray-200 p-4 dark:border-gray-700">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Uvoz voznikov iz XLSX</label>
        <input
          type="file"
          name="file"
          accept=".xlsx"
          required
          className="mt-1 block text-sm text-gray-900 dark:text-gray-100"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Stolpci (poljuben vrstni red): Ime, Podjetje, ID koda</p>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Uvažam …" : "Uvozi"}
      </button>
      {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {state?.created !== undefined && (
        <div className="space-y-1 text-sm">
          <p className="text-green-700 dark:text-green-400">Uvoženih voznikov: {state.created}</p>
          {state.errors && (
            <ul className="list-disc space-y-0.5 pl-5 text-red-600 dark:text-red-400">
              {state.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
