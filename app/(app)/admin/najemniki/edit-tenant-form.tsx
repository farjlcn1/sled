"use client";

import { useActionState, useEffect } from "react";
import { updateTenant } from "./actions";

export type EditableTenant = {
  id: string;
  name: string;
  status: string;
  planIds: string[];
  billingAddress: string | null;
  taxId: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  billingEmails: string[];
  autoSendInvoice: boolean;
};

const STATUS_OPTIONS = [
  { value: "AKTIVEN", label: "Aktiven" },
  { value: "NEAKTIVEN", label: "Neaktiven" },
  { value: "TEST", label: "Test" },
  { value: "V_ODPOVEDI", label: "V odpovedi" },
];

function fieldClass() {
  return "mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
}

export function EditTenantForm({
  tenant,
  plans,
  onClose,
}: {
  tenant: EditableTenant;
  plans: { id: string; name: string }[];
  onClose: () => void;
}) {
  const boundUpdate = updateTenant.bind(null, tenant.id);
  const [state, formAction, pending] = useActionState(boundUpdate, undefined);

  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30" onClick={onClose}>
      <form
        action={formAction}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl space-y-3 rounded-md border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900"
      >
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Uredi podjetje — {tenant.name}</h3>

        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Ime
            <input name="name" defaultValue={tenant.name} required className={fieldClass()} />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Status
            <select name="status" defaultValue={tenant.status} className={fieldClass()}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Davčna številka
            <input name="taxId" defaultValue={tenant.taxId ?? ""} placeholder="SI12345678" className={fieldClass()} />
          </label>
          <label className="col-span-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Naslov
            <input
              name="billingAddress"
              defaultValue={tenant.billingAddress ?? ""}
              placeholder="Ulica 1, 1000 Ljubljana"
              className={fieldClass()}
            />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Kontaktna oseba
            <input name="contactPerson" defaultValue={tenant.contactPerson ?? ""} className={fieldClass()} />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Telefon
            <input name="contactPhone" defaultValue={tenant.contactPhone ?? ""} className={fieldClass()} />
          </label>
          <label className="col-span-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            E-poštni naslovi za račune (en na vrstico ali ločeni z vejico)
            <textarea
              name="billingEmails"
              defaultValue={tenant.billingEmails.join("\n")}
              placeholder={"racunovodstvo@podjetje.si\nlastnik@podjetje.si"}
              rows={2}
              className={fieldClass()}
            />
          </label>
          <label className="col-span-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" name="autoSendInvoice" defaultChecked={tenant.autoSendInvoice} />
            Samodejno pošlji mesečni račun po e-pošti
          </label>
        </div>

        <div>
          <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Paketi (lahko izbereš več hkrati)
          </span>
          <div className="mt-1 space-y-1 rounded-md border border-gray-300 p-2 dark:border-gray-600">
            {plans.length === 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">Ni na voljo nobenega paketa.</p>
            )}
            {plans.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" name="planIds" value={p.id} defaultChecked={tenant.planIds.includes(p.id)} />
                {p.name}
              </label>
            ))}
          </div>
        </div>

        {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300"
          >
            Prekliči
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "Shranjujem …" : "Shrani"}
          </button>
        </div>
      </form>
    </div>
  );
}
