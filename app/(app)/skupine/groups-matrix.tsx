"use client";

import { useMemo, useState, useTransition } from "react";
import { saveGroupMemberships } from "../vozila/actions";

export type GroupRow = { id: string; name: string; memberIds: string[] };
export type VehicleCol = { id: string; plate: string };

function key(groupId: string, vehicleId: string) {
  return `${groupId}:${vehicleId}`;
}

function buildInitial(groups: GroupRow[]): Record<string, boolean> {
  const state: Record<string, boolean> = {};
  for (const g of groups) {
    for (const vehicleId of g.memberIds) state[key(g.id, vehicleId)] = true;
  }
  return state;
}

// Spremembe se do klika na "Shrani" hranijo samo lokalno — narejena tako namenoma, glej opombo
// na gumbu spodaj: nič se ne posreduje strežniku, dokler uporabnik ne potrdi s Shrani.
export function GroupsMatrix({ groups, vehicles }: { groups: GroupRow[]; vehicles: VehicleCol[] }) {
  const initial = useMemo(() => buildInitial(groups), [groups]);
  const [membership, setMembership] = useState<Record<string, boolean>>(initial);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const dirty = useMemo(() => {
    const keys = new Set([...Object.keys(initial), ...Object.keys(membership)]);
    for (const k of keys) {
      if (Boolean(initial[k]) !== Boolean(membership[k])) return true;
    }
    return false;
  }, [initial, membership]);

  function toggle(groupId: string, vehicleId: string) {
    const k = key(groupId, vehicleId);
    setMembership((prev) => ({ ...prev, [k]: !prev[k] }));
    setMessage(null);
  }

  function handleSave() {
    const changes: { groupId: string; vehicleId: string; inGroup: boolean }[] = [];
    for (const g of groups) {
      for (const v of vehicles) {
        const k = key(g.id, v.id);
        changes.push({ groupId: g.id, vehicleId: v.id, inGroup: Boolean(membership[k]) });
      }
    }
    startTransition(async () => {
      const result = await saveGroupMemberships(changes);
      setMessage(result?.error ?? "Spremembe shranjene.");
    });
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Skupina</th>
              {vehicles.map((v) => (
                <th key={v.id} className="px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                  {v.plate}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {groups.map((g) => (
              <tr key={g.id}>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{g.name}</td>
                {vehicles.map((v) => (
                  <td key={v.id} className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={Boolean(membership[key(g.id, v.id)])}
                      onChange={() => toggle(g.id, v.id)}
                    />
                  </td>
                ))}
              </tr>
            ))}
            {groups.length === 0 && (
              <tr>
                <td colSpan={vehicles.length + 1} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  Ni še skupin vozil.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {groups.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            title="Spremembe v zgornji razpredelnici se shranijo šele s klikom na ta gumb."
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPending ? "Shranjujem …" : "Shrani"}
          </button>
          {dirty && !isPending && (
            <span className="text-sm text-gray-500 dark:text-gray-400">Neshranjene spremembe</span>
          )}
          {message && <span className="text-sm text-gray-700 dark:text-gray-300">{message}</span>}
        </div>
      )}
    </div>
  );
}
