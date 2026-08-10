"use client";

import { useActionState, useState } from "react";
import { createTenantUser } from "./actions";

type Level = "SUDO" | "UP" | "U" | "DEMO";

const LEVEL_OPTIONS: { value: Level; label: string }[] = [
  { value: "UP", label: "UP — upravitelj podjetja" },
  { value: "U", label: "U — uporabnik" },
  { value: "DEMO", label: "Demo — samo izbrana vozila" },
];

export function AddUserForm({
  isSudo,
  tenantId,
  vehicles,
  groups,
}: {
  isSudo: boolean;
  tenantId?: string;
  vehicles: { id: string; plate: string }[];
  groups: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createTenantUser, undefined);
  const [level, setLevel] = useState<Level>("U");
  const [passwordMode, setPasswordMode] = useState<"manual" | "generate">("generate");

  const needsTenant = level !== "SUDO";
  const showGroupAccess = level === "U";
  const showVehicleAccess = level === "U" || level === "DEMO";
  const levelOptions = isSudo ? [{ value: "SUDO" as Level, label: "Sudo — dostop do vsega" }, ...LEVEL_OPTIONS] : LEVEL_OPTIONS;

  return (
    <form action={formAction} className="space-y-4 rounded-md border border-gray-200 p-4 dark:border-gray-700">
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
          <input
            name="email"
            type="email"
            required
            className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Ime in priimek</label>
          <input
            name="fullName"
            required
            className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nivo</label>
          <select
            name="level"
            value={level}
            onChange={(e) => setLevel(e.target.value as Level)}
            className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            {levelOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {needsTenant && tenantId && <input type="hidden" name="tenantId" value={tenantId} />}
      {needsTenant && !tenantId && (
        <p className="text-sm text-amber-600 dark:text-amber-400">Najprej izberi podjetje zgoraj na strani.</p>
      )}

      <fieldset>
        <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">Geslo</legend>
        <div className="mt-2 flex flex-wrap items-end gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="radio"
              name="passwordMode"
              value="generate"
              checked={passwordMode === "generate"}
              onChange={() => setPasswordMode("generate")}
            />
            Samodejno generiraj in pošlji na email
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="radio"
              name="passwordMode"
              value="manual"
              checked={passwordMode === "manual"}
              onChange={() => setPasswordMode("manual")}
            />
            Nastavi geslo ročno
          </label>
          {passwordMode === "manual" && (
            <div>
              <input
                name="manualPassword"
                type="password"
                required
                placeholder="Geslo"
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Vsaj 8 znakov, vsaj 1 velika črka, 1 številka, 1 poseben znak.
              </p>
            </div>
          )}
        </div>
      </fieldset>

      {showGroupAccess && groups.length > 0 && (
        <fieldset>
          <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">Dostop do skupin vozil</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            {groups.map((g) => (
              <label key={g.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" name="groupIds" value={g.id} />
                {g.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {showVehicleAccess && (
        <fieldset>
          <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">Dostop do posameznih vozil</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            {vehicles.map((v) => (
              <label key={v.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" name="vehicleIds" value={v.id} />
                {v.plate}
              </label>
            ))}
            {vehicles.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">Ni še vozil.</p>}
          </div>
        </fieldset>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Ustvarjam …" : "Ustvari uporabnika"}
      </button>

      {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {state?.createdEmail && !state.generatedPassword && (
        <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-900 dark:border-green-700 dark:bg-green-950 dark:text-green-100">
          Uporabnik <strong>{state.createdEmail}</strong> ustvarjen.{" "}
          {state.emailSent ? "Geslo je bilo poslano na email." : "Geslo je bilo nastavljeno ročno."}
        </div>
      )}
      {state?.generatedPassword && (
        <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-100">
          Uporabnik <strong>{state.createdEmail}</strong> ustvarjen, a pošiljanje gesla po e-pošti ni uspelo ali ni
          nastavljeno — posreduj ročno: <code className="rounded bg-white px-1 dark:bg-black">{state.generatedPassword}</code>
        </div>
      )}
    </form>
  );
}
