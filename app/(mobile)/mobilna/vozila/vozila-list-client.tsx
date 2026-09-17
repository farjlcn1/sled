"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ICON_SVG } from "@/lib/vehicle-icons";
import type { VehicleIcon } from "@/app/api/pozicije/route";

export type VozilaListItem = {
  id: string;
  plate: string;
  brandModel: string;
  icon: VehicleIcon;
  driverName: string | null;
};

export function VozilaListClient({ vehicles }: { vehicles: VozilaListItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter(
      (v) =>
        v.plate.toLowerCase().includes(q) ||
        v.brandModel.toLowerCase().includes(q) ||
        (v.driverName?.toLowerCase().includes(q) ?? false)
    );
  }, [vehicles, search]);

  return (
    <div className="space-y-3 p-3">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Išči vozilo ali voznika …"
        className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      />

      <div className="space-y-2">
        {filtered.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => router.push(`/mobilna/vozila/${v.id}`)}
            className="flex w-full items-center gap-3 rounded-md border border-gray-200 bg-white p-3 text-left dark:border-gray-700 dark:bg-gray-800"
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-400 dark:bg-gray-500"
              dangerouslySetInnerHTML={{ __html: ICON_SVG[v.icon] }}
            />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-gray-900 dark:text-gray-100">{v.plate}</div>
              <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                {v.brandModel}
                {v.driverName ? ` · ${v.driverName}` : ""}
              </div>
            </div>
            <span className="shrink-0 text-gray-400 dark:text-gray-500">›</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {search.trim() ? "Ni najdenih vozil." : "Ni vozil."}
          </p>
        )}
      </div>
    </div>
  );
}
