import type { VehicleIcon } from "@/app/api/pozicije/route";

// Deljeno med zemljevidom (components/vehicle-map.tsx, prek innerHTML na MapLibre markerju) in
// seznamom vozil (app/(app)/zemljevid/vehicle-row.tsx, prek dangerouslySetInnerHTML) -- ista
// preprosta bela silhueta na obarvanem krogu na obeh mestih.
export const ICON_SVG: Record<VehicleIcon, string> = {
  CAR: `<svg viewBox="0 0 24 24" width="13" height="13" fill="white"><rect x="3" y="12" width="18" height="5" rx="2"/><path d="M7 12 L8.5 8 Q9.2 7 10.3 7 L14.5 7 Q15.6 7 16.2 8 L17.5 12 Z"/><circle cx="7.5" cy="17" r="2.1"/><circle cx="16.5" cy="17" r="2.1"/></svg>`,
  VAN: `<svg viewBox="0 0 24 24" width="13" height="13" fill="white"><rect x="4" y="6" width="16" height="10" rx="1.5"/><circle cx="8" cy="17" r="2.1"/><circle cx="16" cy="17" r="2.1"/></svg>`,
  TRUCK: `<svg viewBox="0 0 24 24" width="13" height="13" fill="white"><rect x="2" y="11" width="7" height="6" rx="1"/><rect x="9" y="6" width="12" height="11" rx="1"/><circle cx="6" cy="18" r="2.1"/><circle cx="17" cy="18" r="2.1"/></svg>`,
  EXCAVATOR: `<svg viewBox="0 0 24 24" width="13" height="13" fill="white"><rect x="2" y="15" width="12" height="4" rx="1"/><rect x="3" y="10" width="7" height="6" rx="1"/><polygon points="9,12 18,4 22,3 23,7 19,9 16,7 13,12"/></svg>`,
  TRACTOR: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="white" stroke-width="2"><rect x="9" y="5" width="8" height="6" rx="1" fill="white" stroke="none"/><rect x="6" y="11" width="10" height="3" rx="1" fill="white" stroke="none"/><circle cx="7" cy="18" r="4.5"/><circle cx="18" cy="19" r="3"/></svg>`,
  MOTORCYCLE: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><path d="M6 18 L11 9 L16 9 L18 18"/></svg>`,
};
