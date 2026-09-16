"use client";

import { useEffect, useRef } from "react";
import { VehicleMap, type VehicleMapHandle } from "@/components/vehicle-map";

const MAX_CENTER_ATTEMPTS = 100;
const CENTER_RETRY_MS = 150;

export function KartaClient({ initialVehicleId }: { initialVehicleId: string | null }) {
  const mapRef = useRef<VehicleMapHandle>(null);

  // Marker za initialVehicleId obstaja šele, ko interni poll VehicleMap-a naloži pozicije --
  // ponavljaj poskus centriranja (isti vzorec kot applyRoutes/tryApply v vehicle-map.tsx), dokler
  // centerOnVehicle ne vrne true ali ne zmanjka poskusov (zasebno/brez naprave/brez pozicije).
  useEffect(() => {
    if (!initialVehicleId) return;
    let cancelled = false;
    let attempts = 0;

    function tryCenter() {
      if (cancelled) return;
      const found = mapRef.current?.centerOnVehicle(initialVehicleId as string) ?? false;
      if (!found && attempts < MAX_CENTER_ATTEMPTS) {
        attempts++;
        setTimeout(tryCenter, CENTER_RETRY_MS);
      }
    }
    tryCenter();

    return () => {
      cancelled = true;
    };
  }, [initialVehicleId]);

  return <VehicleMap ref={mapRef} maximized fillContainer />;
}
