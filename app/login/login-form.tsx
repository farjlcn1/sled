"use client";

import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <form
      action={formAction}
      className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow dark:bg-gray-800"
    >
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Sledenje — prijava</h1>
      <input type="hidden" name="redirectTo" value={redirectTo} />

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Email
        </label>
        <input
          id="email"
          type="email"
          name="email"
          required
          autoComplete="username"
          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Geslo
        </label>
        <input
          id="password"
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" name="rememberMe" className="h-4 w-4 rounded border-gray-300" />
        Zapomni si me
      </label>

      {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-base font-medium text-white disabled:opacity-50"
      >
        {pending ? "Prijavljam …" : "Prijava"}
      </button>
    </form>
  );
}
