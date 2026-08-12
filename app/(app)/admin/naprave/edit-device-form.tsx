"use client";

import { useActionState, useEffect } from "react";
import { updateDevice } from "./actions";

export const PROTOCOL_OPTIONS: { value: string; label: string }[] = [
  { value: "TELTONIKA", label: "Teltonika" },
  { value: "OTHER", label: "Drugo" },
];

export type EditableDevice = {
  id: string;
  imei: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  simNumber: string | null;
  note: string | null;
  protocol: string;
};

function fieldClass() {
  return "mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
}

export function EditDeviceForm({
  device,
  onClose,
}: {
  device: EditableDevice;
  onClose: () => void;
}) {
  const boundUpdate = updateDevice.bind(null, device.id);
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
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Uredi napravo — {device.imei}</h3>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Znamka
            <input name="brand" defaultValue={device.brand ?? ""} className={fieldClass()} />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Model
            <input name="model" defaultValue={device.model ?? ""} className={fieldClass()} />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Serijska št.
            <input name="serialNumber" defaultValue={device.serialNumber ?? ""} className={fieldClass()} />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            SIM
            <input name="simNumber" defaultValue={device.simNumber ?? ""} className={fieldClass()} />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Protokol
            <select name="protocol" defaultValue={device.protocol} className={fieldClass()}>
              {PROTOCOL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Opomba
            <input name="note" defaultValue={device.note ?? ""} className={fieldClass()} />
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
