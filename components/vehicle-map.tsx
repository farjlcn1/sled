"use client";

import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, Marker, Popup, LngLatBounds, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { VehicleIcon, VehiclePosition } from "@/app/api/pozicije/route";
import type { VehicleStatus } from "@/lib/vehicle-status";

// Turbopack corrupts maplibre-gl's self-bootstrapped worker (glej next.config.ts) — uporabimo
// ločeno CSP datoteko namesto tega. Mora biti klicano pred prvim new MapLibreMap(...).
if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre-gl-csp-worker.js");
}

const POLL_INTERVAL_MS = 5000;
const MAX_APPLY_ATTEMPTS = 100;
const APPLY_RETRY_MS = 150;

const STATUS_COLOR: Record<VehicleStatus, string> = {
  driving: "#22c55e", // zelena — v vožnji
  idle: "#f97316", // oranžna — ignition prižgan, miruje
  parked: "#ef4444", // rdeča — ignition ugasnjen
  unknown: "#6b7280",
};

// Preproste, minimalistične ikone (samo osnovne oblike) — bela silhueta znotraj obarvanega kroga.
const ICON_SVG: Record<VehicleIcon, string> = {
  CAR: `<svg viewBox="0 0 24 24" width="13" height="13" fill="white"><rect x="3" y="11" width="18" height="7" rx="2"/><rect x="6" y="6" width="12" height="6" rx="1.5"/></svg>`,
  VAN: `<svg viewBox="0 0 24 24" width="13" height="13" fill="white"><rect x="4" y="5" width="16" height="14" rx="2"/></svg>`,
  TRUCK: `<svg viewBox="0 0 24 24" width="13" height="13" fill="white"><rect x="2" y="10" width="8" height="8" rx="1"/><rect x="10" y="5" width="12" height="13" rx="1"/></svg>`,
  EXCAVATOR: `<svg viewBox="0 0 24 24" width="13" height="13" fill="white"><rect x="2" y="12" width="11" height="7" rx="1"/><polygon points="11,13 22,3 22,8 15,13"/></svg>`,
  TRACTOR: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="white" stroke-width="2"><rect x="9" y="5" width="8" height="6" rx="1" fill="white" stroke="none"/><circle cx="7" cy="18" r="4.5"/><circle cx="18" cy="19" r="3"/></svg>`,
  MOTORCYCLE: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><path d="M6 18 L11 9 L16 9 L18 18"/></svg>`,
};

export type HistoryRoute = {
  path: [number, number][];
  plate: string;
  icon: VehicleIcon;
  status: VehicleStatus;
};

// Enoten videz markerja povsod: obarvan krog z ikono vozila + stalno viden napis registrske.
function createMarkerElement(icon: VehicleIcon, plate: string, color: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "vehicle-marker";

  const badge = document.createElement("span");
  badge.className = "vehicle-marker-badge";
  badge.style.backgroundColor = color;
  badge.innerHTML = ICON_SVG[icon];

  const label = document.createElement("span");
  label.className = "vehicle-marker-label";
  label.textContent = plate;

  el.appendChild(badge);
  el.appendChild(label);
  return el;
}

const ROUTE_SOURCE_ID = "history-route";
const ROUTE_LAYER_ID = "history-route-line";

export function VehicleMap({
  visibleVehicleIds,
  historyRoute,
}: {
  visibleVehicleIds?: Set<string>;
  historyRoute?: HistoryRoute | null;
} = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const historyMarkerRef = useRef<Marker | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const visibleVehicleIdsRef = useRef(visibleVehicleIds);

  useEffect(() => {
    visibleVehicleIdsRef.current = visibleVehicleIds;
  }, [visibleVehicleIds]);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      // Interim brezplačni vir vektorskih ploščkov (isti OpenMapTiles model, ki ga
      // bomo kasneje gostili sami prek Planetiler/PMTiles) — glej arhitekturni načrt.
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [14.9955, 46.1512], // Slovenija
      zoom: 8,
    });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Riše celotno pot naložene zgodovine + ikono vozila z registrsko na najnovejši poziciji.
  // addSource/addLayer lahko vržeta izjemo, ce slog zemljevida se ni v celoti pripravljen —
  // namesto da bi cakali na kak konkreten dogodek/zastavico (v praksi nezanesljivo v tem
  // okolju), preprosto poskusimo in ob napaki na kratko počakamo ter poskusimo znova (do ~15s).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    let attempts = 0;
    setRouteError(null);

    function applyRoute() {
      if (!map) return;
      if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
      if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
      historyMarkerRef.current?.remove();
      historyMarkerRef.current = null;

      if (!historyRoute || historyRoute.path.length === 0) return;

      if (historyRoute.path.length > 1) {
        map.addSource(ROUTE_SOURCE_ID, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: historyRoute.path },
          },
        });
        map.addLayer({
          id: ROUTE_LAYER_ID,
          type: "line",
          source: ROUTE_SOURCE_ID,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#2563eb", "line-width": 4, "line-opacity": 0.75 },
        });
      }

      const lastPoint = historyRoute.path[historyRoute.path.length - 1];
      historyMarkerRef.current = new Marker({
        element: createMarkerElement(historyRoute.icon, historyRoute.plate, STATUS_COLOR[historyRoute.status]),
      })
        .setLngLat(lastPoint)
        .addTo(map);

      const bounds = historyRoute.path.reduce(
        (b, coord) => b.extend(coord),
        new LngLatBounds(historyRoute.path[0], historyRoute.path[0])
      );
      map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 300 });
    }

    function tryApply() {
      if (cancelled) return;
      try {
        applyRoute();
      } catch {
        if (attempts < MAX_APPLY_ATTEMPTS) {
          attempts++;
          setTimeout(tryApply, APPLY_RETRY_MS);
        } else if (historyRoute) {
          setRouteError("Poti ni bilo mogoče izrisati (zemljevid se ni pripravil pravočasno). Poskusi znova.");
        }
      }
    }
    tryApply();

    return () => {
      cancelled = true;
    };
  }, [historyRoute]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/pozicije", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { positions } = (await res.json()) as { positions: VehiclePosition[] };
        if (cancelled || !mapRef.current) return;
        setError(null);
        const allowed = visibleVehicleIdsRef.current;
        updateMarkers(allowed ? positions.filter((p) => allowed.has(p.vehicleId)) : positions);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Napaka pri branju pozicij.");
      }
    }

    function updateMarkers(positions: VehiclePosition[]) {
      const map = mapRef.current;
      if (!map) return;
      const seen = new Set<string>();

      for (const pos of positions) {
        seen.add(pos.vehicleId);
        let marker = markersRef.current.get(pos.vehicleId);
        if (!marker) {
          const el = createMarkerElement(pos.icon, pos.plate, STATUS_COLOR[pos.status]);
          marker = new Marker({ element: el })
            .setLngLat([pos.longitude, pos.latitude])
            .setPopup(new Popup({ offset: 14 }))
            .addTo(map);
          markersRef.current.set(pos.vehicleId, marker);
        }
        marker.setLngLat([pos.longitude, pos.latitude]);
        const badge = marker.getElement().querySelector<HTMLElement>(".vehicle-marker-badge");
        if (badge) badge.style.backgroundColor = STATUS_COLOR[pos.status];

        const popupEl = document.createElement("div");
        const strong = document.createElement("strong");
        strong.textContent = pos.plate;
        popupEl.appendChild(strong);
        popupEl.appendChild(document.createElement("br"));
        popupEl.appendChild(document.createTextNode(`${Math.round(pos.speed)} km/h`));
        marker.getPopup()?.setDOMContent(popupEl);
      }

      for (const [vehicleId, marker] of markersRef.current) {
        if (!seen.has(vehicleId)) {
          marker.remove();
          markersRef.current.delete(vehicleId);
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

  return (
    <div className="relative h-[75vh] min-h-[520px] w-full overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
      <div ref={containerRef} className="h-full w-full" />
      {(error || routeError) && (
        <p className="absolute bottom-2 left-2 rounded bg-red-600/90 px-2 py-1 text-xs text-white">
          {error ?? routeError}
        </p>
      )}
      <style jsx global>{`
        .vehicle-marker {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .vehicle-marker-badge {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .vehicle-marker-label {
          white-space: nowrap;
          background: white;
          color: #111827;
          font-size: 11px;
          font-weight: 600;
          padding: 1px 5px;
          border-radius: 4px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
        }
      `}</style>
    </div>
  );
}
