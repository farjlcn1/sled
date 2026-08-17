import type { VehicleIcon } from "@/app/api/pozicije/route";

// Deljeno med zemljevidom (components/vehicle-map.tsx, prek innerHTML na MapLibre markerju) in
// seznamom vozil (app/(app)/zemljevid/vehicle-row.tsx, prek dangerouslySetInnerHTML) -- ista
// preprosta bela silhueta na obarvanem krogu na obeh mestih.
export const ICON_SVG: Record<VehicleIcon, string> = {
  CAR: `<svg viewBox="0 0 24 24" width="13" height="13" fill="white"><rect x="3" y="11" width="18" height="7" rx="2"/><rect x="6" y="6" width="12" height="6" rx="1.5"/></svg>`,
  VAN: `<svg viewBox="0 0 24 24" width="13" height="13" fill="white"><rect x="4" y="5" width="16" height="14" rx="2"/></svg>`,
  TRUCK: `<svg viewBox="0 0 24 24" width="13" height="13" fill="white"><rect x="2" y="10" width="8" height="8" rx="1"/><rect x="10" y="5" width="12" height="13" rx="1"/></svg>`,
  EXCAVATOR: `<svg viewBox="0 0 24 24" width="13" height="13" fill="white"><rect x="2" y="12" width="11" height="7" rx="1"/><polygon points="11,13 22,3 22,8 15,13"/></svg>`,
  TRACTOR: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="white" stroke-width="2"><rect x="9" y="5" width="8" height="6" rx="1" fill="white" stroke="none"/><circle cx="7" cy="18" r="4.5"/><circle cx="18" cy="19" r="3"/></svg>`,
  MOTORCYCLE: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><path d="M6 18 L11 9 L16 9 L18 18"/></svg>`,
};
