"use client";

import { useActionState, useEffect } from "react";
import { updateDriver } from "./actions";

export type EditableDriver = {
  id: string;
  fullName: string;
  phone: string | null;
  licenseNumber: string | null;
  idMethod: string;
  idCode: string | null;
};

function fieldClass() {
  return "mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
}

export function EditDriverForm({ driver, onClose }: { driver: EditableDriver; onClose: () => void }) {
  const boundUpdate = updateDriver.bind(null, driver.id);
  const [state, formAction, pending] = useActionState(boundUpdate, undefined);

  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30" onClick={onClose}>
      <form
        action={formAction}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg space-y-3 rounded-md border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900"
      >
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Uredi voznika — {driver.fullName}</h3>

        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Ime in priimek
            <input name="fullName" defaultValue={driver.fullName} required className={fieldClass()} />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Telefon
            <input name="phone" defaultValue={driver.phone ?? ""} className={fieldClass()} />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Št. vozniškega dovoljenja
            <input name="licenseNumber" defaultValue={driver.licenseNumber ?? ""} className={fieldClass()} />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Način ID
            <select name="idMethod" defaultValue={driver.idMethod} className={fieldClass()}>
              <option value="RFID">RFID</option>
              <option value="IBUTTON">iButton</option>
              <option value="MANUAL">Ročno</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            ID koda (RFID/iButton)
            <input name="idCode" defaultValue={driver.idCode ?? ""} placeholder="neobvezno" className={fieldClass()} />
          </label>
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
