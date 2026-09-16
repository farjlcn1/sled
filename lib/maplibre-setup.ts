import { setWorkerUrl } from "maplibre-gl";

let didSetup = false;

// Turbopack corrupts maplibre-gl's self-bootstrapped worker (glej next.config.ts) -- uporabimo
// ločeno CSP datoteko namesto tega. Mora biti klicano pred prvim new MapLibreMap(...). Deljeno med
// vehicle-map.tsx (poln zemljevid) in vehicle-mini-map.tsx (mini zemljevidi), da logika in
// komentar ne razideta v dveh kopijah.
export function ensureMaplibreWorker() {
  if (didSetup || typeof window === "undefined") return;
  didSetup = true;
  setWorkerUrl("/maplibre-gl-csp-worker.js");
}
