"use client";

import { useActionState } from "react";
import { updateTenantBillingSettings } from "./actions";

export function BillingSettingsForm({
  tenant,
}: {
  tenant: { id: string; billingEmail: string | null; autoSendInvoice: boolean };
}) {
  const boundUpdate = updateTenantBillingSettings.bind(null, tenant.id);
  const [state, formAction, pending] = useActionState(boundUpdate, undefined);

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-4 rounded-md border border-gray-200 p-4 dark:border-gray-700"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">E-pošta za račune</label>
        <input
          name="billingEmail"
          type="email"
          defaultValue={tenant.billingEmail ?? ""}
          placeholder="racunovodstvo@podjetje.si"
          className="mt-1 w-64 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>
      <label className="flex items-center gap-2 pb-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" name="autoSendInvoice" defaultChecked={tenant.autoSendInvoice} />
        Samodejno pošlji mesečni račun po e-pošti
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Shranjujem …" : "Shrani"}
      </button>
      {state?.error && <p className="w-full text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {state?.success && <p className="w-full text-sm text-green-600 dark:text-green-400">Shranjeno.</p>}
    </form>
  );
}
