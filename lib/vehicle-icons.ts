import type { VehicleIcon } from "@/app/api/pozicije/route";

// Deljeno med zemljevidom (components/vehicle-map.tsx, prek innerHTML na MapLibre markerju) in
// seznamom vozil (app/(app)/zemljevid/vehicle-row.tsx, prek dangerouslySetInnerHTML) -- ista
// preprosta bela silhueta na obarvanem krogu na obeh mestih.
// Velikost (width/height) je za ~33% večja od prejšnje (13 -> 17.3), viewBox pa nespremenjen --
// dodatne podrobnosti spodaj (okno, izpuh, žaromet) so avtorsko dodane s tem odstotkom v mislih,
// da ostanejo v okvirju vidne pri tej velikosti.
export const ICON_SVG: Record<VehicleIcon, string> = {
  CAR: `<svg viewBox="0 0 24 24" width="17.3" height="17.3" fill="white"><rect x="3" y="12" width="18" height="5" rx="2"/><path fill-rule="evenodd" d="M7 12 L8.5 8 Q9.2 7 10.3 7 L14.5 7 Q15.6 7 16.2 8 L17.5 12 Z M9.3 11 L10 8.9 L14.8 8.9 L15.5 11 Z"/><circle cx="7.5" cy="17" r="2.1"/><circle cx="16.5" cy="17" r="2.1"/></svg>`,
  VAN: `<svg viewBox="0 0 24 24" width="17.3" height="17.3" fill="white"><path fill-rule="evenodd" d="M5.5 6 H18.5 Q20 6 20 7.5 V14.5 Q20 16 18.5 16 H5.5 Q4 16 4 14.5 V7.5 Q4 6 5.5 6 Z M14.3 7.5 H18 V10.3 H14.3 Z"/><circle cx="8" cy="17" r="2.1"/><circle cx="16" cy="17" r="2.1"/></svg>`,
  TRUCK: `<svg viewBox="0 0 24 24" width="17.3" height="17.3" fill="white"><path fill-rule="evenodd" d="M3 11 H8 Q9 11 9 12 V16 Q9 17 8 17 H3 Q2 17 2 16 V12 Q2 11 3 11 Z M3.7 12.3 H6.5 V14.3 H3.7 Z"/><rect x="9" y="6" width="12" height="11" rx="1"/><circle cx="6" cy="18" r="2.1"/><circle cx="17" cy="18" r="2.1"/></svg>`,
  EXCAVATOR: `<svg viewBox="0 0 24 24" width="17.3" height="17.3" fill="white"><rect x="2" y="15" width="12" height="4" rx="1"/><path fill-rule="evenodd" d="M4 10 H9 Q10 10 10 11 V15 Q10 16 9 16 H4 Q3 16 3 15 V11 Q3 10 4 10 Z M4.7 11.3 H7.5 V13.3 H4.7 Z"/><polygon points="9,12 18,4 22,3 23,7 19,9 16,7 13,12"/></svg>`,
  TRACTOR: `<svg viewBox="0 0 24 24" width="17.3" height="17.3" fill="none" stroke="white" stroke-width="2"><rect x="15.2" y="1.5" width="1.6" height="4" rx="0.6" fill="white" stroke="none"/><rect x="9" y="5" width="8" height="6" rx="1" fill="white" stroke="none"/><rect x="6" y="11" width="10" height="3" rx="1" fill="white" stroke="none"/><circle cx="7" cy="18" r="4.5"/><circle cx="18" cy="19" r="3"/></svg>`,
  MOTORCYCLE: `<svg viewBox="0 0 24 24" width="17.3" height="17.3" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><path d="M6 18 L11 9 L16 9 L18 18"/><circle cx="17" cy="9.5" r="1.3" fill="white" stroke="none"/></svg>`,
};
