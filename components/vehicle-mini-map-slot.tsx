"use client";

import { useEffect, useRef, useState } from "react";
import { VehicleMiniMap } from "./vehicle-mini-map";
import { STATUS_DOT_COLOR, type VehicleStatus } from "@/lib/vehicle-status";

// Mobilni WebView (Android Chromium) omeji sočasne WebGL kontekste na približno 8-16, preden
// najstarejše tiho izloči -- dolg seznam vozil bi to zlahka presegel, če bi imela vsaka vrstica
// trajno živ zemljevid. Zato mount/unmount pravega VehicleMiniMap-a veže na IntersectionObserver:
// samo vrstice na/blizu zaslona kadarkoli držijo pravo instanco.
export function VehicleMiniMapSlot({
  lat,
  lon,
  status,
}: {
  lat: number | null;
  lon: number | null;
  status: VehicleStatus;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      root: null,
      rootMargin: "300px 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="h-20 w-full overflow-hidden rounded-md">
      {lat == null || lon == null ? (
        <div className="flex h-full w-full items-center justify-center bg-gray-100 text-[11px] text-gray-400 dark:bg-gray-700 dark:text-gray-500">
          Ni lokacije
        </div>
      ) : inView ? (
        <VehicleMiniMap lat={lat} lon={lon} color={STATUS_DOT_COLOR[status]} />
      ) : (
        <div className="h-full w-full bg-gray-100 dark:bg-gray-700" />
      )}
    </div>
  );
}
