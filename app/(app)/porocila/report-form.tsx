"use client";

import { REPORT_TYPE_OPTIONS } from "@/lib/report-type-options";
import { SlovenianDateInput } from "@/components/date-input";

// d.toISOString() vrne UTC datum, d.setDate/getDate pa delata v lokalnem času -- v Ljubljani
// (UTC+2) lokalna polnoč pade na 22:00 UTC PREJŠNJEGA dne, zato bi toISOString().slice(0,10) tu
// vrnil dan prej kot je dejansko mišljeno. Za "lokalni koledarski dan" sestavimo niz iz lokalnih
// komponent, ne iz UTC.
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return localDateStr(d) + "T00:00";
}

function defaultTo() {
  return localDateStr(new Date()) + "T23:59";
}

export function ReportForm({
  vehicles,
  groups,
  selectedVehicleId,
  selectedGroupId,
  selectedType,
  from,
  to,
}: {
  vehicles: { id: string; plate: string }[];
  groups: { id: string; name: string }[];
  selectedVehicleId?: string;
  selectedGroupId?: string;
  selectedType?: string;
  from?: string;
  to?: string;
}) {
  return (
    <form className="flex flex-wrap items-end gap-3 rounded-md border border-gray-200 p-4 dark:border-gray-700">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Vozilo</label>
        <select
          name="vehicleId"
          defaultValue={selectedVehicleId ?? ""}
          className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">— brez —</option>
          <option value="__all__">— vse —</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.plate}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Skupina</label>
        <select
          name="groupId"
          defaultValue={selectedGroupId ?? ""}
          className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">— brez —</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tip poročila</label>
        <select
          name="tip"
          defaultValue={selectedType ?? "voznje"}
          className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          {REPORT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Od</label>
        <SlovenianDateInput name="from" withTime defaultValue={from ?? defaultFrom()} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Do</label>
        <SlovenianDateInput name="to" withTime defaultValue={to ?? defaultTo()} />
      </div>
      <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
        Prikaži poročilo
      </button>
      <p className="w-full text-xs text-gray-500 dark:text-gray-400">
        Izberi vozilo ALI skupino (če je izbrana skupina, se prikažejo podatki za vsa vozila v njej) —
        ali "— vse —" za poročilo o vseh dostopnih vozilih.
      </p>
    </form>
  );
}
