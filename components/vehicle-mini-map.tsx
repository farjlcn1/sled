"use client";

import { useEffect, useRef } from "react";
import { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ensureMaplibreWorker } from "@/lib/maplibre-setup";

ensureMaplibreWorker();

export function VehicleMiniMap({ lat, lon, color }: { lat: number; lon: number; color: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerElRef = useRef<HTMLDivElement | null>(null);

  // Enkraten mount -- WebGL kontekst se ustvari samo tukaj (glej vehicle-mini-map-slot.tsx za
  // razlog: virtualizacija zanaša na to, da unmount res pokliče map.remove()). Barva je na
  // custom DOM elementu (ne privzeti MapLibre pin), da jo lahko spodnji efekt spreminja brez
  // ponovnega ustvarjanja markerja.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [lon, lat],
      zoom: 14,
      interactive: false,
      attributionControl: false,
    });
    mapRef.current = map;

    const el = document.createElement("div");
    el.style.width = "14px";
    el.style.height = "14px";
    el.style.borderRadius = "9999px";
    el.style.border = "2px solid white";
    el.style.boxShadow = "0 0 2px rgba(0,0,0,0.5)";
    el.style.backgroundColor = color;
    markerElRef.current = el;
    new Marker({ element: el }).setLngLat([lon, lat]).addTo(map);

    // Container se lahko poveča/zmanjša PO tem, ko je bil zemljevid že zgrajen (glej
    // vehicle-card.tsx: velikost se izmeri prek ResizeObserverja šele po prvem izrisu, privzeto
    // je 80px) -- MapLibre sam canvas ob tem ne preračuna, dokler se izrecno ne pokliče resize().
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      markerElRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mapRef.current?.setCenter([lon, lat]);
  }, [lat, lon]);

  useEffect(() => {
    if (markerElRef.current) markerElRef.current.style.backgroundColor = color;
  }, [color]);

  return <div ref={containerRef} className="h-full w-full" />;
}
