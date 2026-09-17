"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ICON_SVG } from "@/lib/vehicle-icons";
import { updateVehiclePlate, saveGroupMemberships } from "@/app/(app)/vozila/actions";
import type { VehicleIcon } from "@/app/api/pozicije/route";

export function EditVehicleClient({
  vehicleId,
  plate,
  brandModel,
  icon,
  groups,
  memberGroupIds,
}: {
  vehicleId: string;
  plate: string;
  brandModel: string;
  icon: VehicleIcon;
  groups: { id: string; name: string }[];
  memberGroupIds: string[];
}) {
  const boundUpdatePlate = updateVehiclePlate.bind(null, vehicleId);
  const [plateState, plateAction, platePending] = useActionState(boundUpdatePlate, undefined);

  // baseline se posodobi šele po uspešnem shranjevanju -- dirtyIds primerja živo stanje proti
  // temu, kar dejansko obstaja v bazi (isti "staged diff, shrani ob kliku" vzorec kot desktop
  // GroupsMatrix, samo za eno vozilo namesto celotne matrike).
  const initialMembership = () => Object.fromEntries(groups.map((g) => [g.id, memberGroupIds.includes(g.id)]));
  const [baseline, setBaseline] = useState<Record<string, boolean>>(initialMembership);
  const [membership, setMembership] = useState<Record<string, boolean>>(initialMembership);
  const [groupsPending, setGroupsPending] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [groupsSuccess, setGroupsSuccess] = useState(false);

  const dirtyIds = groups.map((g) => g.id).filter((id) => membership[id] !== baseline[id]);
  const isDirty = dirtyIds.length > 0;

  function toggleGroup(groupId: string) {
    setGroupsSuccess(false);
    setMembership((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }

  async function handleSaveGroups() {
    setGroupsPending(true);
    setGroupsError(null);
    setGroupsSuccess(false);
    const changes = dirtyIds.map((groupId) => ({ groupId, vehicleId, inGroup: membership[groupId] }));
    try {
      const result = await saveGroupMemberships(changes);
      if (result?.error) {
        setGroupsError(result.error);
      } else {
        setBaseline(membership);
        setGroupsSuccess(true);
      }
    } catch {
      setGroupsError("Napaka pri shranjevanju.");
    } finally {
      setGroupsPending(false);
    }
  }

  return (
    <div className="space-y-4 p-3">
      <Link href="/mobilna/vozila" className="text-sm text-blue-600 dark:text-blue-400">
        ← Nazaj
      </Link>

      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-400 dark:bg-gray-500"
          dangerouslySetInnerHTML={{ __html: ICON_SVG[icon] }}
        />
        <div className="min-w-0">
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{plate}</div>
          <div className="truncate text-sm text-gray-500 dark:text-gray-400">{brandModel}</div>
        </div>
      </div>

      <div className="space-y-2 rounded-md border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Registrska številka</h2>
        <form action={plateAction} className="flex gap-2">
          <input
            type="text"
            name="plate"
            defaultValue={plate}
            required
            className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
          <button
            type="submit"
            disabled={platePending}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Shrani
          </button>
        </form>
        {plateState?.error && <p className="text-sm text-red-600 dark:text-red-400">{plateState.error}</p>}
        {plateState?.success && <p className="text-sm text-green-600 dark:text-green-400">Shranjeno.</p>}
      </div>

      <div className="space-y-2 rounded-md border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Skupine</h2>
        {groups.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">Ni skupin.</p>}
        <div className="space-y-1">
          {groups.map((g) => (
            <label key={g.id} className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100">
              <input
                type="checkbox"
                checked={membership[g.id] ?? false}
                onChange={() => toggleGroup(g.id)}
                className="h-4 w-4"
              />
              {g.name}
            </label>
          ))}
        </div>
        {groups.length > 0 && (
          <button
            type="button"
            onClick={handleSaveGroups}
            disabled={!isDirty || groupsPending}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Shrani spremembe
          </button>
        )}
        {groupsError && <p className="text-sm text-red-600 dark:text-red-400">{groupsError}</p>}
        {groupsSuccess && <p className="text-sm text-green-600 dark:text-green-400">Shranjeno.</p>}
      </div>
    </div>
  );
}
