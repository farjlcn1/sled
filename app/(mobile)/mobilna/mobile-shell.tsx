"use client";

import { useEffect, useRef, useState } from "react";
import { VehicleMap, type VehicleMapHandle } from "@/components/vehicle-map";
import { MobileVehicleCard } from "./vehicle-card";
import { MobileGroupRow } from "./group-row";
import { fetchJson, SessionExpiredError } from "@/lib/fetch-json";
import type { VehicleIcon } from "@/app/api/pozicije/route";
import type { MobileVehicleStatus } from "@/app/api/vozila/status-batch/route";

export type MobileVehicle = {
  id: string;
  plate: string;
  icon: VehicleIcon;
  driverName: string | null;
  isPrivateMode: boolean;
};

export type MobileGroup = {
  id: string;
  name: string;
  vehicleIds: string[];
};

const POLL_INTERVAL_MS = 5000;

export function MobileShell({ vehicles, groups }: { vehicles: MobileVehicle[]; groups: MobileGroup[] }) {
  const [activeTab, setActiveTab] = useState<"vozila" | "skupine">("vozila");
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(() => new Set());
  const [statusById, setStatusById] = useState<Record<string, MobileVehicleStatus>>({});
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<VehicleMapHandle>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const data = await fetchJson<Record<string, MobileVehicleStatus>>("/api/vozila/status-batch", {
          cache: "no-store",
        });
        if (!cancelled) {
          setStatusById(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof SessionExpiredError ? err.message : "Podatkov trenutno ni mogoče prikazati.");
        }
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  function toggleGroup(groupId: string) {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function handleSelect(vehicleId: string) {
    mapRef.current?.centerOnVehicle(vehicleId);
  }

  const vehiclesById = new Map(vehicles.map((v) => [v.id, v]));

  return (
    <div className="space-y-3">
      <VehicleMap ref={mapRef} maximized />

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex rounded-md border border-gray-300 dark:border-gray-600">
        <button
          type="button"
          onClick={() => setActiveTab("vozila")}
          className={`flex-1 rounded-l-md px-3 py-2 text-sm font-medium ${
            activeTab === "vozila" ? "bg-blue-600 text-white" : "bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          Vozila
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("skupine")}
          className={`flex-1 rounded-r-md px-3 py-2 text-sm font-medium ${
            activeTab === "skupine" ? "bg-blue-600 text-white" : "bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          Skupine
        </button>
      </div>

      {activeTab === "vozila" && (
        <div className="space-y-2">
          {vehicles.map((v) => (
            <MobileVehicleCard key={v.id} vehicle={v} live={statusById[v.id]} onSelect={handleSelect} />
          ))}
          {vehicles.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">Ni vozil.</p>}
        </div>
      )}

      {activeTab === "skupine" && (
        <div className="space-y-2">
          {groups.map((g) => (
            <div key={g.id} className="space-y-2">
              <MobileGroupRow
                name={g.name}
                vehicleCount={g.vehicleIds.length}
                expanded={expandedGroupIds.has(g.id)}
                onToggleExpand={() => toggleGroup(g.id)}
              />
              {expandedGroupIds.has(g.id) && (
                <div className="space-y-2 pl-2">
                  {g.vehicleIds
                    .map((id) => vehiclesById.get(id))
                    .filter((v): v is MobileVehicle => v != null)
                    .map((v) => (
                      <MobileVehicleCard key={v.id} vehicle={v} live={statusById[v.id]} onSelect={handleSelect} />
                    ))}
                </div>
              )}
            </div>
          ))}
          {groups.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">Ni skupin.</p>}
        </div>
      )}
    </div>
  );
}
