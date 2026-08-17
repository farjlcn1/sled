"use client";

import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, Marker, Popup, LngLatBounds, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { VehicleIcon, VehiclePosition } from "@/app/api/pozicije/route";
import type { VehicleStatus } from "@/lib/vehicle-status";
import { ICON_SVG } from "@/lib/vehicle-icons";

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

const STATUS_TEXT: Record<VehicleStatus, string> = {
  driving: "V vožnji",
  idle: "Kontakt vklopljen",
  parked: "Kontakt izklopljen",
  unknown: "Neznano",
};

export type HistoryRoute = {
  path: [number, number][];
  vehicleId: string;
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

const LABEL_HALF_W = 55; // ocenjena polovica širine značke+napisa (px)
const LABEL_HALF_H = 15;
const DECLUTTER_STEP = 26; // ~višina značke — korak navpičnega razmika pri prekrivanju

// HTML markerji (znacka + stalno viden napis registrske) ne dobijo MapLibrove vgrajene izogibe
// prekrivanju (ta velja samo za GL "symbol" plasti, ne za poljubne HTML markerje) — zato jih tu
// rocno razmaknemo navpicno, ce bi se pri trenutnem zoomu prekrivali. Klice se po vsaki
// posodobitvi pozicij/poti ter po vsakem premiku/zoomu zemljevida.
function declutterMarkers(map: MapLibreMap, markers: Marker[]) {
  const placed: { x: number; y: number }[] = [];
  for (const marker of markers) {
    const { x, y } = map.project(marker.getLngLat());
    let offsetY = 0;
    let attempt = 0;
    while (
      attempt < 10 &&
      placed.some((p) => Math.abs(p.x - x) < LABEL_HALF_W * 2 && Math.abs(p.y - (y + offsetY)) < LABEL_HALF_H * 2)
    ) {
      attempt++;
      const step = Math.ceil(attempt / 2) * DECLUTTER_STEP;
      offsetY = attempt % 2 === 1 ? step : -step;
    }
    marker.setOffset([0, offsetY]);
    placed.push({ x, y: y + offsetY });
  }
}

// Liang-Barsky obrezovanje daljice ob pravokotniku -- vrne true tudi, ko je cel segment "prebodel"
// pravokotnik brez da bi bila katera od njegovih dveh krajišč (točk) dejansko znotraj (npr. dolg
// segment med dvema oddaljenima GPS točkama, ki gre samo mimo/skozi majhen izbirni okvir).
function segmentIntersectsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;

  function clip(p: number, q: number): boolean {
    if (p === 0) return q >= 0; // vzporedno z robom -- znotraj samo, če je že na pravi strani
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  }

  if (!clip(-dx, x1 - minX)) return false;
  if (!clip(dx, maxX - x1)) return false;
  if (!clip(-dy, y1 - minY)) return false;
  if (!clip(dy, maxY - y1)) return false;
  return t0 <= t1;
}

const ROUTE_SOURCE_PREFIX = "history-route";
const ROUTE_LAYER_PREFIX = "history-route-line";
const ROUTE_COLORS = [
  "#2563eb", "#9333ea", "#0d9488", "#db2777", "#d97706",
  "#4338ca", "#0891b2", "#e11d48", "#65a30d", "#c026d3",
];

// Barva za tocke/segmente, izbrane v tabeli zgodovine spodaj — ujema se z bg-amber-* v vrsticah tabele.
const HIGHLIGHT_COLOR = "#f59e0b";
const HL_LINE_SOURCE_PREFIX = "highlight-line";
const HL_LINE_LAYER_PREFIX = "highlight-line-layer";
const HL_POINTS_SOURCE_PREFIX = "highlight-points";
const HL_POINTS_LAYER_PREFIX = "highlight-points-layer";

export function VehicleMap({
  visibleVehicleIds,
  historyRoutes,
  highlightPaths,
  onDragSelect,
}: {
  visibleVehicleIds?: Set<string>;
  historyRoutes?: HistoryRoute[];
  highlightPaths?: [number, number][][];
  // Shift+vlečenje po zemljevidu (glej efekt spodaj) — sporoči, katere točke katerih narisanih
  // poti so pristale znotraj izbirnega pravokotnika, da jih klicatelj lahko označi v tabeli.
  onDragSelect?: (results: { vehicleId: string; indices: number[] }[]) => void;
} = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  const resizeDragRef = useRef<{
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    axis: "x" | "y" | "both";
  } | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const historyMarkersRef = useRef<Marker[]>([]);
  const prevRouteCountRef = useRef(0);
  const prevHighlightCountRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const visibleVehicleIdsRef = useRef(visibleVehicleIds);
  const pollRef = useRef<() => void>(() => {});
  const historyRoutesRef = useRef<HistoryRoute[]>([]);
  const onDragSelectRef = useRef(onDragSelect);
  const selectDragRef = useRef<{ startX: number; startY: number } | null>(null);
  const selectBoxElRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    historyRoutesRef.current = historyRoutes ?? [];
  }, [historyRoutes]);
  onDragSelectRef.current = onDragSelect;

  useEffect(() => {
    visibleVehicleIdsRef.current = visibleVehicleIds;
    // Ne čakaj na naslednji predviden interval — ob vsaki spremembi izbire (kljukica) takoj
    // povleci sveže pozicije, da se novo izbrano vozilo prikaže na zemljevidu brez čakanja do 5s.
    pollRef.current();
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

    // Ob vsakem premiku/zoomu se lahko spremenijo zasedena mesta na zaslonu — ponovno razmakni napise.
    function handleViewChange() {
      declutterMarkers(map, [...markersRef.current.values(), ...historyMarkersRef.current]);
    }
    map.on("moveend", handleViewChange);
    map.on("zoomend", handleViewChange);

    return () => {
      map.off("moveend", handleViewChange);
      map.off("zoomend", handleViewChange);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Shift+klik-in-vlečenje po zemljevidu izriše izbirni pravokotnik; ob spustu miške vsaka
  // narisana pot (glej historyRoutesRef), katere kakšna točka pade vanj, sporoči svoje indekse
  // navzgor prek onDragSelect -- klicatelj jih uporabi za označitev vrstic v tabeli spodaj.
  // Brez Shift bi trčilo z MapLibrovim lastnim vlečenjem za premikanje zemljevida, zato med
  // izbiranjem map.dragPan izklopimo.
  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container) return;

    function pointFromEvent(e: MouseEvent): { x: number; y: number } {
      const rect = container!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function handleMouseDown(e: MouseEvent) {
      if (!e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      map!.dragPan.disable();
      const { x, y } = pointFromEvent(e);
      selectDragRef.current = { startX: x, startY: y };

      const box = document.createElement("div");
      box.style.position = "absolute";
      box.style.left = `${x}px`;
      box.style.top = `${y}px`;
      box.style.width = "0px";
      box.style.height = "0px";
      box.style.border = "2px dashed #2563eb";
      box.style.background = "rgba(37, 99, 235, 0.15)";
      box.style.pointerEvents = "none";
      box.style.zIndex = "20";
      container!.appendChild(box);
      selectBoxElRef.current = box;
    }

    function handleMouseMove(e: MouseEvent) {
      const drag = selectDragRef.current;
      const box = selectBoxElRef.current;
      if (!drag || !box) return;
      const { x, y } = pointFromEvent(e);
      box.style.left = `${Math.min(drag.startX, x)}px`;
      box.style.top = `${Math.min(drag.startY, y)}px`;
      box.style.width = `${Math.abs(x - drag.startX)}px`;
      box.style.height = `${Math.abs(y - drag.startY)}px`;
    }

    function handleMouseUp(e: MouseEvent) {
      const drag = selectDragRef.current;
      const box = selectBoxElRef.current;
      selectDragRef.current = null;
      selectBoxElRef.current = null;
      map!.dragPan.enable();
      if (!drag || !box) return;
      box.remove();

      const { x, y } = pointFromEvent(e);
      const minX = Math.min(drag.startX, x);
      const maxX = Math.max(drag.startX, x);
      const minY = Math.min(drag.startY, y);
      const maxY = Math.max(drag.startY, y);

      // Premik pod tem pragom je bolj podoben trepetu miške kot namernemu izbiranju.
      if (maxX - minX < 4 && maxY - minY < 4) return;

      const results: { vehicleId: string; indices: number[] }[] = [];
      for (const route of historyRoutesRef.current) {
        const projected = route.path.map((coord) => map!.project(coord));
        const selected = new Set<number>();

        projected.forEach((p, idx) => {
          if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) selected.add(idx);
        });
        // Tudi segment, ki samo prečka izbirni okvir (nobena od obeh točk ni znotraj), zajame
        // OBE svoji krajišči -- "delček črte v okvirju zajame celotno črto".
        for (let i = 0; i < projected.length - 1; i++) {
          const a = projected[i];
          const b = projected[i + 1];
          if (segmentIntersectsRect(a.x, a.y, b.x, b.y, minX, minY, maxX, maxY)) {
            selected.add(i);
            selected.add(i + 1);
          }
        }

        if (selected.size > 0) results.push({ vehicleId: route.vehicleId, indices: Array.from(selected) });
      }
      if (results.length > 0) onDragSelectRef.current?.(results);
    }

    container.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      container.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // MapLibre GL JS sam ne zazna spremembe CSS velikosti svojega vsebnika — canvas je treba ob
  // vsaki spremembi velikosti (npr. ročno raztegovanje spodaj) eksplicitno ponovno umeriti z
  // map.resize(), sicer ostane po raztegu videti pokvarjen (napačna velikost/prazna polja).
  useEffect(() => {
    if (!outerRef.current) return;

    const observer = new ResizeObserver(() => {
      mapRef.current?.resize();
    });
    observer.observe(outerRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Ročice za spremembo velikosti (glej JSX) — nativna CSS "resize" lastnost se je izkazala za
  // nezanesljivo, ker MapLibrov lastni "attribution" kontrolnik sedi točno v spodnjem desnem kotu
  // in prestreza klike, namenjene brskalnikovi kljuki za raztegovanje. Zato velikost upravljamo sami,
  // z ločenimi ročicami za višino (spodaj), širino (desno) in obe hkrati (spodnji desni kot).
  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      const drag = resizeDragRef.current;
      if (!drag) return;
      if (drag.axis === "y" || drag.axis === "both") {
        setHeight(Math.max(320, drag.startHeight + (e.clientY - drag.startY)));
      }
      if (drag.axis === "x" || drag.axis === "both") {
        setWidth(Math.max(320, drag.startWidth + (e.clientX - drag.startX)));
      }
    }
    function handleMouseUp() {
      resizeDragRef.current = null;
    }
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  function handleResizeHandleMouseDown(axis: "x" | "y" | "both") {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      const rect = outerRef.current?.getBoundingClientRect();
      resizeDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startWidth: rect?.width ?? 640,
        startHeight: rect?.height ?? 520,
        axis,
      };
    };
  }

  // Riše celotno pot naložene zgodovine + ikono vozila z registrsko na najnovejši poziciji.
  // addSource/addLayer lahko vržeta izjemo, ce slog zemljevida se ni v celoti pripravljen —
  // namesto da bi cakali na kak konkreten dogodek/zastavico (v praksi nezanesljivo v tem
  // okolju), preprosto poskusimo in ob napaki na kratko počakamo ter poskusimo znova (do ~15s).
  // Riše celotne poti naloženih zgodovin (ena ali vec vozil hkrati, vsaka v svoji barvi) + ikono
  // vozila z registrsko na najnovejši poziciji vsake. addSource/addLayer lahko vržeta izjemo, ce
  // slog zemljevida se ni v celoti pripravljen — namesto da bi cakali na kak konkreten dogodek,
  // preprosto poskusimo in ob napaki na kratko počakamo ter poskusimo znova (do ~15s).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    let attempts = 0;
    setRouteError(null);

    function applyRoutes() {
      if (!map) return;
      for (let i = 0; i < prevRouteCountRef.current; i++) {
        const layerId = `${ROUTE_LAYER_PREFIX}-${i}`;
        const sourceId = `${ROUTE_SOURCE_PREFIX}-${i}`;
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      }
      historyMarkersRef.current.forEach((m) => m.remove());
      historyMarkersRef.current = [];

      const routes = (historyRoutes ?? []).filter((r) => r.path.length > 0);
      prevRouteCountRef.current = routes.length;

      let bounds: LngLatBounds | null = null;

      routes.forEach((route, i) => {
        const color = ROUTE_COLORS[i % ROUTE_COLORS.length];

        if (route.path.length > 1) {
          const sourceId = `${ROUTE_SOURCE_PREFIX}-${i}`;
          const layerId = `${ROUTE_LAYER_PREFIX}-${i}`;
          map.addSource(sourceId, {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: route.path },
            },
          });
          map.addLayer({
            id: layerId,
            type: "line",
            source: sourceId,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": color, "line-width": 4, "line-opacity": 0.75 },
          });
        }

        const lastPoint = route.path[route.path.length - 1];
        const marker = new Marker({
          element: createMarkerElement(route.icon, route.plate, STATUS_COLOR[route.status]),
        })
          .setLngLat(lastPoint)
          .addTo(map);
        historyMarkersRef.current.push(marker);

        for (const coord of route.path) {
          bounds = bounds ? bounds.extend(coord) : new LngLatBounds(coord, coord);
        }
      });

      declutterMarkers(map, [...markersRef.current.values(), ...historyMarkersRef.current]);

      // maxZoom omeji, kako blizu se približa za majhen/mirujoč niz točk (npr. eno samo parkirano
      // vozilo) -- 14 je bilo pretesno (skoraj ulična raven), 12 pusti več okoliškega konteksta.
      if (bounds) map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 300 });

      // Izbrane vrstice v tabeli zgodovine spodaj — narisano nad vsem ostalim, ne vpliva na fitBounds
      // (izbira vrstice naj ne premika/zoomira zemljevida).
      for (let i = 0; i < prevHighlightCountRef.current; i++) {
        const lineLayer = `${HL_LINE_LAYER_PREFIX}-${i}`;
        const lineSource = `${HL_LINE_SOURCE_PREFIX}-${i}`;
        const pointLayer = `${HL_POINTS_LAYER_PREFIX}-${i}`;
        const pointSource = `${HL_POINTS_SOURCE_PREFIX}-${i}`;
        if (map.getLayer(lineLayer)) map.removeLayer(lineLayer);
        if (map.getSource(lineSource)) map.removeSource(lineSource);
        if (map.getLayer(pointLayer)) map.removeLayer(pointLayer);
        if (map.getSource(pointSource)) map.removeSource(pointSource);
      }
      const paths = (highlightPaths ?? []).filter((p) => p.length > 0);
      prevHighlightCountRef.current = paths.length;

      paths.forEach((path, i) => {
        const pointSource = `${HL_POINTS_SOURCE_PREFIX}-${i}`;
        const pointLayer = `${HL_POINTS_LAYER_PREFIX}-${i}`;
        map.addSource(pointSource, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: path.map((coord) => ({
              type: "Feature",
              properties: {},
              geometry: { type: "Point", coordinates: coord },
            })),
          },
        });
        map.addLayer({
          id: pointLayer,
          type: "circle",
          source: pointSource,
          paint: {
            "circle-radius": 6,
            "circle-color": HIGHLIGHT_COLOR,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });

        if (path.length > 1) {
          const lineSource = `${HL_LINE_SOURCE_PREFIX}-${i}`;
          const lineLayer = `${HL_LINE_LAYER_PREFIX}-${i}`;
          map.addSource(lineSource, {
            type: "geojson",
            data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: path } },
          });
          map.addLayer({
            id: lineLayer,
            type: "line",
            source: lineSource,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": HIGHLIGHT_COLOR, "line-width": 5, "line-opacity": 0.9 },
          });
        }
      });
    }

    function tryApply() {
      if (cancelled) return;
      try {
        applyRoutes();
      } catch {
        if (attempts < MAX_APPLY_ATTEMPTS) {
          attempts++;
          setTimeout(tryApply, APPLY_RETRY_MS);
        } else if ((historyRoutes && historyRoutes.length > 0) || (highlightPaths && highlightPaths.length > 0)) {
          setRouteError("Poti ni bilo mogoče izrisati (zemljevid se ni pripravil pravočasno). Poskusi znova.");
        }
      }
    }
    tryApply();

    return () => {
      cancelled = true;
    };
  }, [historyRoutes, highlightPaths]);

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
    pollRef.current = poll;

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
        popupEl.appendChild(document.createTextNode(`${Math.round(pos.speed)} km/h — ${STATUS_TEXT[pos.status]}`));
        popupEl.appendChild(document.createElement("br"));
        popupEl.appendChild(
          document.createTextNode(
            `Zadnja meritev: ${new Date(pos.fixTime).toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit" })}`
          )
        );
        marker.getPopup()?.setDOMContent(popupEl);
      }

      for (const [vehicleId, marker] of markersRef.current) {
        if (!seen.has(vehicleId)) {
          marker.remove();
          markersRef.current.delete(vehicleId);
        }
      }

      declutterMarkers(map, [...markersRef.current.values(), ...historyMarkersRef.current]);
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div
      ref={outerRef}
      className={`relative overflow-hidden rounded-md border border-gray-200 dark:border-gray-700 ${
        height === null ? "h-[75vh] min-h-[520px]" : ""
      } ${width === null ? "w-full" : ""}`}
      style={{
        ...(height !== null ? { height } : undefined),
        ...(width !== null ? { width } : undefined),
        minHeight: 320,
        minWidth: 320,
      }}
    >
      <div ref={containerRef} className="relative h-full w-full" />
      {(historyRoutes ?? []).some((r) => r.path.length > 0) && (
        <p className="absolute top-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
          Shift + vlečenje po poti za izbiro točk
        </p>
      )}
      {(error || routeError) && (
        <p className="absolute bottom-2 left-2 rounded bg-red-600/90 px-2 py-1 text-xs text-white">
          {error ?? routeError}
        </p>
      )}
      {/* spodnji rob — samo višina */}
      <div
        onMouseDown={handleResizeHandleMouseDown("y")}
        title="Povleci za spremembo višine"
        className="absolute inset-x-0 bottom-0 z-20 flex h-3 cursor-ns-resize items-center justify-center hover:bg-black/10 dark:hover:bg-white/10"
      >
        <div className="h-1 w-10 rounded-full bg-gray-400/80 dark:bg-gray-300/70" />
      </div>
      {/* desni rob — samo širina */}
      <div
        onMouseDown={handleResizeHandleMouseDown("x")}
        title="Povleci za spremembo širine"
        className="absolute inset-y-0 right-0 z-20 flex w-3 cursor-ew-resize items-center justify-center hover:bg-black/10 dark:hover:bg-white/10"
      >
        <div className="h-10 w-1 rounded-full bg-gray-400/80 dark:bg-gray-300/70" />
      </div>
      {/* spodnji desni kot — obe hkrati (diagonalno) */}
      <div
        onMouseDown={handleResizeHandleMouseDown("both")}
        title="Povleci za spremembo velikosti"
        className="absolute bottom-0 right-0 z-20 h-4 w-4 cursor-nwse-resize"
      >
        <svg viewBox="0 0 16 16" className="h-full w-full text-gray-400/80 dark:text-gray-300/70">
          <path
            d="M14 2 L2 14 M14 7 L7 14 M14 12 L12 14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
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
        /* MapLibrov privzeti pojavni oblaček podeduje barvo besedila od strani (temni način jo
           postavi zelo svetlo), ozadje pa ostane MapLibrovo lastno belo -- brez tega je besedilo
           komaj vidno. Enako kot zgoraj: neodvisno od trenutne teme strani. */
        .maplibregl-popup-content {
          background: white;
          color: #111827;
          font-size: 12px;
          line-height: 1.5;
          padding: 10px 12px;
          border-radius: 6px;
        }
        .maplibregl-popup-anchor-bottom .maplibregl-popup-tip {
          border-top-color: white;
        }
      `}</style>
    </div>
  );
}
