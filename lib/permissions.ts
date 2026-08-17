// Deljeno med strežniško akcijo (app/(app)/uporabniki/actions.ts) in klientsko komponento
// (edit-user-dialog.tsx) -- ne more živeti v actions.ts, ker "use server" datoteke lahko
// izvažajo samo async funkcije, ne navadnih konstant.

export type UserLevel = "SUDO" | "UP" | "U" | "DEMO";

export type PermissionFlags = {
  canManagePlatform: boolean;
  canManageUsers: boolean;
  canManageVehicles: boolean;
  canManageDrivers: boolean;
  canViewReports: boolean;
};

export const LEVEL_PERMISSIONS: Record<UserLevel, PermissionFlags> = {
  SUDO: { canManagePlatform: true, canManageUsers: true, canManageVehicles: true, canManageDrivers: true, canViewReports: true },
  UP: { canManagePlatform: false, canManageUsers: true, canManageVehicles: true, canManageDrivers: true, canViewReports: true },
  U: { canManagePlatform: false, canManageUsers: false, canManageVehicles: false, canManageDrivers: false, canViewReports: true },
  DEMO: { canManagePlatform: false, canManageUsers: false, canManageVehicles: false, canManageDrivers: false, canViewReports: false },
};

// Isti seznam kot v app/(app)/layout.tsx -- ena definicija za dejansko navigacijo IN za predogled
// "katere zavihke bo ta uporabnik videl" v edit-user-dialog.tsx, da ne pride do razhajanja.
export const NAV_TABS: { href: string; label: string; show: (p: PermissionFlags) => boolean }[] = [
  { href: "/zemljevid", label: "Zemljevid", show: () => true },
  { href: "/vozila", label: "Vozila", show: (p) => p.canManageVehicles || p.canManagePlatform },
  { href: "/skupine", label: "Skupine", show: (p) => p.canManageVehicles || p.canManagePlatform },
  { href: "/rezervacije", label: "Rezervacija vozila", show: (p) => p.canManageVehicles || p.canManagePlatform },
  { href: "/vozniki", label: "Vozniki", show: () => true },
  { href: "/porocila", label: "Poročila", show: (p) => p.canViewReports },
  { href: "/potni-nalogi", label: "Potni nalogi", show: (p) => p.canManageUsers },
  { href: "/tacho", label: "Tacho", show: (p) => p.canManageUsers },
  { href: "/uporabniki", label: "Uporabniki", show: (p) => p.canManageUsers },
  { href: "/admin/naprave", label: "Naprave", show: (p) => p.canManagePlatform },
  { href: "/admin/najemniki", label: "Podjetja", show: (p) => p.canManagePlatform },
  { href: "/admin/paketi", label: "Paketi", show: (p) => p.canManagePlatform },
  { href: "/revizijska-sled", label: "Revizijska sled", show: (p) => p.canManagePlatform },
];
