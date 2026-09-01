"use client";

import { EditVehicleSection, type EditableVehicle } from "./[id]/edit-vehicle-section";

export type { EditableVehicle };

// Samo pojavno okno okoli EditVehicleSection (glej tam) -- polja in gumbi (vključno z Arhiviraj)
// so ena sama implementacija, deljena s stranjo posameznega vozila, da se ne moreta razhajati.
export function EditVehicleForm({
  vehicle,
  availableDevices,
  onClose,
}: {
  vehicle: EditableVehicle;
  availableDevices: { id: string; imei: string; protocol: string; brand: string | null; model: string | null }[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-md border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900"
      >
        <h3 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">Uredi vozilo — {vehicle.plate}</h3>
        <EditVehicleSection vehicle={vehicle} availableDevices={availableDevices} onClose={onClose} />
      </div>
    </div>
  );
}
