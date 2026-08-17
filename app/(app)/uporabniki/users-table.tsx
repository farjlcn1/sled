"use client";

import { useMemo, useState } from "react";
import { EditUserDialog } from "./edit-user-dialog";
import { ToggleActiveButton } from "./toggle-active-button";
import type { UserLevel } from "@/lib/permissions";

type Level = UserLevel;

const LEVEL_LABELS: Record<string, string> = {
  SUDO: "Sudo",
  UP: "UP — upravitelj podjetja",
  U: "Uporabnik",
  DEMO: "Demo",
};

export type UserRow = {
  id: string;
  email: string;
  fullName: string;
  level: Level;
  isActive: boolean;
  vehicleIds: string[];
  groupIds: string[];
};

type SortDir = "asc" | "desc";
type ColumnKey = "email" | "fullName" | "level" | "isActive";

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "fullName", label: "Ime" },
  { key: "level", label: "Nivo" },
  { key: "isActive", label: "Status" },
];

function sortValue(u: UserRow, key: ColumnKey): string | number {
  switch (key) {
    case "email":
      return u.email;
    case "fullName":
      return u.fullName;
    case "level":
      return u.level;
    case "isActive":
      return u.isActive ? 1 : 0;
  }
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "sl-SI", { numeric: true });
}

export function UsersTable({
  users,
  vehicles,
  groups,
  isSudo,
}: {
  users: UserRow[];
  vehicles: { id: string; plate: string }[];
  groups: { id: string; name: string }[];
  isSudo: boolean;
}) {
  const [sort, setSort] = useState<{ key: ColumnKey; dir: SortDir } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return users;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...users].sort((a, b) => factor * compare(sortValue(a, sort.key), sortValue(b, sort.key)));
  }, [users, sort]);

  function handleSort(key: ColumnKey) {
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function sortIndicator(key: ColumnKey) {
    if (sort?.key !== key) return "";
    return sort.dir === "asc" ? " ▲" : " ▼";
  }

  return (
    <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className="cursor-pointer select-none px-4 py-2 text-left text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {col.label}
                {sortIndicator(col.key)}
              </th>
            ))}
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {sorted.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{u.email}</td>
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{u.fullName}</td>
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{LEVEL_LABELS[u.level]}</td>
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                {u.isActive ? "Aktiven" : "Onemogočen"}
              </td>
              <td className="px-4 py-2 text-right">
                <div className="flex items-center justify-end gap-2">
                  <EditUserDialog
                    targetUser={{
                      id: u.id,
                      email: u.email,
                      level: u.level,
                      vehicleIds: u.vehicleIds,
                      groupIds: u.groupIds,
                    }}
                    vehicles={vehicles}
                    groups={groups}
                    isSudo={isSudo}
                  />
                  <ToggleActiveButton userId={u.id} isActive={u.isActive} />
                </div>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length + 1} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Ni še uporabnikov.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
