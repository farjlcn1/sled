"use client";

import { useActionState, useEffect } from "react";
import { updateVehicle } from "./actions";

const ICON_OPTIONS: { value: string; label: string }[] = [
  { value: "CAR", label: "Osebno vozilo" },
  { value: "VAN", label: "Kombi" },
  { value: "TRUCK", label: "Kamion" },
  { value: "EXCAVATOR", label: "Bager" },
  { value: "TRACTOR", label: "Traktor" },
  { value: "MOTORCYCLE", label: "Motor" },
];

export type EditableVehicle = {
  id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  icon: string;
  fuelTankVolumeL: number | null;
  note: string | null;
  deviceId: string | null;
  registrationDate: string | null;
  nextServiceDate: string | null;
  nextServiceKm: number | null;
};

function fieldClass() {
  return "mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
}

export function EditVehicleForm({
  vehicle,
  availableDevices,
  onClose,
}: {
  vehicle: EditableVehicle;
  availableDevices: { id: string; imei: string }[];
  onClose: () => void;
}) {
  const boundUpdate = updateVehicle.bind(null, vehicle.id);
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
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Uredi vozilo — {vehicle.plate}</h3>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Registrska št.
            <input name="plate" defaultValue={vehicle.plate} required className={fieldClass()} />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Ikona
            <select name="icon" defaultValue={vehicle.icon} className={fieldClass()}>
              {ICON_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Znamka
            <input name="brand" defaultValue={vehicle.brand ?? ""} className={fieldClass()} />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Model
            <input name="model" defaultValue={vehicle.model ?? ""} className={fieldClass()} />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Letnik
            <input name="year" type="number" defaultValue={vehicle.year ?? ""} className={`${fieldClass()} no-spinner`} />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Volumen rezervoarja (L)
            <input
              name="fuelTankVolumeL"
              type="number"
              step="0.1"
              min="0"
              defaultValue={vehicle.fuelTankVolumeL ?? ""}
              className={`${fieldClass()} no-spinner`}
            />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Datum registracije
            <input
              name="registrationDate"
              type="date"
              defaultValue={vehicle.registrationDate ? vehicle.registrationDate.slice(0, 10) : ""}
              className={fieldClass()}
            />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Naslednji servis (datum)
            <input
              name="nextServiceDate"
              type="date"
              defaultValue={vehicle.nextServiceDate ? vehicle.nextServiceDate.slice(0, 10) : ""}
              className={fieldClass()}
            />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Naslednji servis (km)
            <input
              name="nextServiceKm"
              type="number"
              step="1"
              min="0"
              defaultValue={vehicle.nextServiceKm ?? ""}
              className={`${fieldClass()} no-spinner`}
            />
          </label>
          <label className="col-span-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Naprava (IMEI)
            <select name="deviceId" defaultValue={vehicle.deviceId ?? ""} className={fieldClass()}>
              <option value="">— brez naprave —</option>
              {availableDevices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.imei}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Komentar
            <input name="note" defaultValue={vehicle.note ?? ""} className={fieldClass()} />
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
