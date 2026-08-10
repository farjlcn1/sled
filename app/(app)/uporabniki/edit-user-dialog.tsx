"use client";

import { useActionState, useState } from "react";
import { updateUser } from "./actions";

type Level = "SUDO" | "UP" | "U" | "DEMO";

const LEVEL_OPTIONS: { value: Level; label: string }[] = [
  { value: "SUDO", label: "Sudo — dostop do vsega" },
  { value: "UP", label: "UP — upravitelj podjetja" },
  { value: "U", label: "U — uporabnik" },
  { value: "DEMO", label: "Demo — samo izbrana vozila" },
];

export function EditUserDialog({
  targetUser,
  vehicles,
  groups,
  isSudo,
}: {
  targetUser: { id: string; email: string; level: Level; vehicleIds: string[]; groupIds: string[] };
  vehicles: { id: string; plate: string }[];
  groups: { id: string; name: string }[];
  isSudo: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateUser, undefined);
  const [level, setLevel] = useState<Level>(targetUser.level);
  const levelOptions = isSudo ? LEVEL_OPTIONS : LEVEL_OPTIONS.filter((o) => o.value !== "SUDO");

  const showGroupAccess = level === "U";
  const showVehicleAccess = level === "U" || level === "DEMO";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 dark:border-gray-600 dark:text-gray-300"
      >
        Uredi
      </button>

      {open && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setOpen(false)}
        >
          <form
            action={formAction}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-md border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900"
          >
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Uredi — {targetUser.email}</h3>
            <input type="hidden" name="userId" value={targetUser.id} />

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

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Novo geslo (pusti prazno, če ne spreminjaš)
              </label>
              <input
                name="newPassword"
                type="password"
                className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Vsaj 8 znakov, vsaj 1 velika črka, 1 številka, 1 poseben znak.
              </p>
            </div>

            {showGroupAccess && groups.length > 0 && (
              <fieldset>
                <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">Dostop do skupin vozil</legend>
                <div className="mt-2 flex flex-wrap gap-4">
                  {groups.map((g) => (
                    <label key={g.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input type="checkbox" name="groupIds" value={g.id} defaultChecked={targetUser.groupIds.includes(g.id)} />
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
                      <input type="checkbox" name="vehicleIds" value={v.id} defaultChecked={targetUser.vehicleIds.includes(v.id)} />
                      {v.plate}
                    </label>
                  ))}
                  {vehicles.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">Ni še vozil.</p>}
                </div>
              </fieldset>
            )}

            {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
            {state?.success && <p className="text-sm text-green-700 dark:text-green-400">Shranjeno.</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300"
              >
                Zapri
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {pending ? "Shranjujem …" : "Shrani"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
