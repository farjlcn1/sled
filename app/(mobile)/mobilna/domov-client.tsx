"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileVehicleCard } from "./vehicle-card";
import { fetchJson, SessionExpiredError } from "@/lib/fetch-json";
import type { VehicleIcon } from "@/app/api/pozicije/route";
import type { MobileVehicleStatus } from "@/app/api/vozila/status-batch/route";

export type MobileVehicle = {
  id: string;
  plate: string;
  brandModel: string;
  icon: VehicleIcon;
  driverName: string | null;
  isPrivateMode: boolean;
};

const POLL_INTERVAL_MS = 5000;

export function DomovClient({ vehicles }: { vehicles: MobileVehicle[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeSegment, setActiveSegment] = useState<"aktivna" | "neaktivna">("aktivna");
  const [statusById, setStatusById] = useState<Record<string, MobileVehicleStatus>>({});
  const [error, setError] = useState<string | null>(null);

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

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter(
      (v) =>
        v.plate.toLowerCase().includes(q) ||
        v.brandModel.toLowerCase().includes(q) ||
        (v.driverName?.toLowerCase().includes(q) ?? false)
    );
  }, [vehicles, search]);

  // Kriterij aktivnosti: vozi ali je vsaj v prostem teku (ignition brez motiona) -- "neaktivna" torej
  // pokrije parked in unknown (brez sveže pozicije/naprave), kar ustreza obstoječemu privzetku v
  // vehicle-card.tsx (status = live?.status ?? "unknown").
  const visibleVehicles = useMemo(() => {
    return searched.filter((v) => {
      const status = statusById[v.id]?.status ?? "unknown";
      const isActive = status === "driving" || status === "idle";
      return activeSegment === "aktivna" ? isActive : !isActive;
    });
  }, [searched, statusById, activeSegment]);

  function handleSelect(vehicleId: string) {
    router.push(`/mobilna/karta?vehicleId=${vehicleId}`);
  }

  return (
    <div className="space-y-3 p-3">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Išči vozilo ali voznika …"
        className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      />

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex rounded-md border border-gray-300 dark:border-gray-600">
        <button
          type="button"
          onClick={() => setActiveSegment("aktivna")}
          className={`flex-1 rounded-l-md px-3 py-2 text-sm font-medium ${
            activeSegment === "aktivna"
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          Aktivna
        </button>
        <button
          type="button"
          onClick={() => setActiveSegment("neaktivna")}
          className={`flex-1 rounded-r-md px-3 py-2 text-sm font-medium ${
            activeSegment === "neaktivna"
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          Neaktivna
        </button>
      </div>

      <div className="space-y-2">
        {visibleVehicles.map((v) => (
          <MobileVehicleCard key={v.id} vehicle={v} live={statusById[v.id]} onSelect={handleSelect} />
        ))}
        {visibleVehicles.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {search.trim() ? "Ni najdenih vozil." : "Ni vozil."}
          </p>
        )}
      </div>
    </div>
  );
}
