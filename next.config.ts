import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Turbopack re-scopes maplibre-gl's UMD bundle into a single chunk, which corrupts the
  // worker source string it reconstructs at runtime (github.com/maplibre/maplibre-gl-js/pull/7406) —
  // silently breaking tile fetching while leaving style/sprite loading intact. The CSP build
  // ships a real separate worker file instead of that trick; see components/vehicle-map.tsx
  // for the matching setWorkerUrl() call.
  turbopack: {
    resolveAlias: {
      "maplibre-gl": { browser: "maplibre-gl/dist/maplibre-gl-csp.js" },
    },
  },
};

export default nextConfig;
