"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { updateVehicle, archiveVehicle, startPrivateMode, endPrivateMode, saveGroupMemberships } from "../actions";
import { SlovenianDateInput } from "@/components/date-input";

const ICON_OPTIONS: { value: string; label: string }[] = [
  { value: "CAR", label: "Osebno vozilo" },
  { value: "VAN", label: "Kombi" },
  { value: "TRUCK", label: "Kamion" },
  { value: "EXCAVATOR", label: "Bager" },
  { value: "TRACTOR", label: "Traktor" },
  { value: "MOTORCYCLE", label: "Motor" },
];

const PROTOCOL_LABELS: Record<string, string> = { TELTONIKA: "Teltonika", OTHER: "Drugo" };

function deviceOptionLabel(d: { imei: string; protocol: string; brand: string | null; model: string | null }): string {
  const type = [PROTOCOL_LABELS[d.protocol] ?? d.protocol, [d.brand, d.model].filter(Boolean).join(" ") || null]
    .filter(Boolean)
    .join(" ");
  return type ? `${d.imei} — ${type}` : d.imei;
}

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
  din1Label: string | null;
  din2Label: string | null;
  din3Label: string | null;
  din4Label: string | null;
  din5Label: string | null;
  din6Label: string | null;
  privateModeDin: number | null;
  isPrivateMode: boolean;
};

function fieldClass() {
  return "mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
}

// Edina implementacija polj/gumbov za urejanje vozila -- uporablja jo tako ta stran (brez onClose,
// vgrajeno neposredno na stran) kot modalno urejanje na seznamu vozil (glej ../edit-vehicle-form.tsx,
// ki to samo zavije v pojavno okno in poda onClose). Namerno ena skupna komponenta namesto dveh
// ločenih -- prej sta se lahko razšli (npr. gumb, dodan samo na eni), zdaj vsaka sprememba tu velja
// na obeh mestih (tudi na desni klik na zemljevidu -> "Vozilo" -> ta stran).
export function EditVehicleSection({
  vehicle,
  availableDevices,
  groups,
  vehicleGroupIds,
  onClose,
}: {
  vehicle: EditableVehicle;
  availableDevices: { id: string; imei: string; protocol: string; brand: string | null; model: string | null }[];
  groups: { id: string; name: string }[];
  vehicleGroupIds: string[];
  onClose?: () => void;
}) {
  const boundUpdate = updateVehicle.bind(null, vehicle.id);
  const [state, formAction, pending] = useActionState(boundUpdate, undefined);
  const [archiving, startArchiving] = useTransition();
  const [archiveError, setArchiveError] = useState<string | null>(null);

  // Enak "izbrano ob kliku Shrani" vzorec kot desktop GroupsMatrix (skupine/groups-matrix.tsx) in
  // mobilni /mobilna/vozila/[id] urejevalnik -- baseline se posodobi šele po uspešnem shranjevanju,
  // dirtyGroupIds primerja živo stanje proti temu, kar dejansko obstaja v bazi.
  const initialMembership = () => Object.fromEntries(groups.map((g) => [g.id, vehicleGroupIds.includes(g.id)]));
  const [groupBaseline, setGroupBaseline] = useState<Record<string, boolean>>(initialMembership);
  const [groupMembership, setGroupMembership] = useState<Record<string, boolean>>(initialMembership);
  const [groupsPending, startGroupsTransition] = useTransition();
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [groupsSuccess, setGroupsSuccess] = useState(false);

  const dirtyGroupIds = groups.map((g) => g.id).filter((id) => groupMembership[id] !== groupBaseline[id]);
  const groupsDirty = dirtyGroupIds.length > 0;

  function toggleGroup(groupId: string) {
    setGroupsSuccess(false);
    setGroupMembership((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }

  function handleSaveGroups() {
    setGroupsError(null);
    setGroupsSuccess(false);
    const changes = dirtyGroupIds.map((groupId) => ({ groupId, vehicleId: vehicle.id, inGroup: groupMembership[groupId] }));
    startGroupsTransition(async () => {
      const result = await saveGroupMemberships(changes);
      if (result?.error) {
        setGroupsError(result.error);
      } else {
        setGroupBaseline(groupMembership);
        setGroupsSuccess(true);
      }
    });
  }

  // Ločeno od "Shrani" -- ima takojšen učinek (odpre/zapre VehiclePrivacyPeriod), zato deluje kot
  // samostojno stikalo (brez name atributa, torej ga glavni submit ignorira), ne kot del
  // shranjevanih podatkov obrazca. Optimistično stanje + povrnitev ob napaki.
  const [isPrivate, setIsPrivate] = useState(vehicle.isPrivateMode);
  const [privacyPending, startPrivacyTransition] = useTransition();
  const [privacyError, setPrivacyError] = useState<string | null>(null);

  useEffect(() => {
    if (state?.success) onClose?.();
  }, [state, onClose]);

  function handlePrivacyToggle(next: boolean) {
    setIsPrivate(next);
    setPrivacyError(null);
    startPrivacyTransition(async () => {
      try {
        if (next) await startPrivateMode(vehicle.id, "WITH_MILEAGE");
        else await endPrivateMode(vehicle.id);
      } catch (err) {
        setIsPrivate(!next);
        setPrivacyError(err instanceof Error ? err.message : "Napaka pri preklopu zasebnega načina.");
      }
    });
  }

  function handleArchive() {
    const ok = confirm(
      `Arhiviraj vozilo ${vehicle.plate}? Sledilna naprava bo odvezana, vozilo pa bo od zdaj vidno samo še pod skupino "Arhiv" na zemljevidu.`
    );
    if (!ok) return;
    startArchiving(async () => {
      const result = await archiveVehicle(vehicle.id);
      if (result?.error) setArchiveError(result.error);
      else onClose?.();
    });
  }

  return (
    <form action={formAction} className="space-y-3">
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
          <SlovenianDateInput
            name="registrationDate"
            defaultValue={vehicle.registrationDate ? vehicle.registrationDate.slice(0, 10) : ""}
          />
        </label>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Naslednji servis (datum)
          <SlovenianDateInput
            name="nextServiceDate"
            defaultValue={vehicle.nextServiceDate ? vehicle.nextServiceDate.slice(0, 10) : ""}
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
          Naprava (IMEI in tip)
          <select name="deviceId" defaultValue={vehicle.deviceId ?? ""} className={fieldClass()}>
            <option value="">— brez naprave —</option>
            {availableDevices.map((d) => (
              <option key={d.id} value={d.id}>
                {deviceOptionLabel(d)}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Opomba
          <input name="note" defaultValue={vehicle.note ?? ""} className={fieldClass()} />
        </label>
      </div>

      <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          DIN priklopi (kaj je fizično priklopljeno na posamezen digitalni vhod)
        </span>
        <div className="mt-1 grid grid-cols-3 gap-3">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
            DIN1
            <input name="din1Label" defaultValue={vehicle.din1Label ?? ""} className={fieldClass()} />
          </label>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
            DIN2
            <input name="din2Label" defaultValue={vehicle.din2Label ?? ""} className={fieldClass()} />
          </label>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
            DIN3
            <input name="din3Label" defaultValue={vehicle.din3Label ?? ""} className={fieldClass()} />
          </label>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
            DIN4
            <input name="din4Label" defaultValue={vehicle.din4Label ?? ""} className={fieldClass()} />
          </label>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
            DIN5
            <input name="din5Label" defaultValue={vehicle.din5Label ?? ""} className={fieldClass()} />
          </label>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
            DIN6
            <input name="din6Label" defaultValue={vehicle.din6Label ?? ""} className={fieldClass()} />
          </label>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">Zasebni način</span>
        <div className="mt-1 grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={isPrivate}
              disabled={privacyPending}
              onChange={(e) => handlePrivacyToggle(e.target.checked)}
            />
            Trenutno v zasebnem načinu
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Samodejno vklopi po DIN
            <select name="privateModeDin" defaultValue={vehicle.privateModeDin ?? ""} className={fieldClass()}>
              <option value="">Brez (samo ročno)</option>
              <option value="1">DIN1</option>
              <option value="2">DIN2</option>
              <option value="3">DIN3</option>
              <option value="4">DIN4</option>
              <option value="5">DIN5</option>
              <option value="6">DIN6</option>
            </select>
          </label>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Če je izbran DIN, ga redna samodejna sinhronizacija upošteva kot vir resnice in lahko prepiše zgornjo ročno kljukico.
        </p>
        {privacyError && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{privacyError}</p>}
      </div>

      <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">Skupine</span>
        {groups.length === 0 ? (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Ni skupin.</p>
        ) : (
          <div className="mt-1 grid grid-cols-2 gap-1">
            {groups.map((g) => (
              <label key={g.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={groupMembership[g.id] ?? false} onChange={() => toggleGroup(g.id)} />
                {g.name}
              </label>
            ))}
          </div>
        )}
        {groups.length > 0 && (
          <button
            type="button"
            onClick={handleSaveGroups}
            disabled={!groupsDirty || groupsPending}
            className="mt-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {groupsPending ? "Shranjujem …" : "Shrani spremembe skupin"}
          </button>
        )}
        {groupsError && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{groupsError}</p>}
        {groupsSuccess && <p className="mt-1 text-sm text-green-600 dark:text-green-400">Shranjeno.</p>}
      </div>

      {(state?.error || archiveError) && (
        <p className="text-sm text-red-600 dark:text-red-400">{state?.error ?? archiveError}</p>
      )}
      {!onClose && state?.success && <p className="text-sm text-green-600 dark:text-green-400">Shranjeno.</p>}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleArchive}
          disabled={archiving || pending}
          className="rounded-md border border-amber-300 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950"
        >
          {archiving ? "Arhiviram …" : "Arhiviraj"}
        </button>
        <div className="flex gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300"
            >
              Prekliči
            </button>
          )}
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "Shranjujem …" : "Shrani"}
          </button>
        </div>
      </div>
    </form>
  );
}
