// Brez "server-only" -- uporabljeno tako v audit-log-table.tsx (client) kot na strežniških straneh.
export const ACTION_LABELS: Record<string, string> = {
  LOGIN: "Prijava",
  LOGIN_FAILED: "Neuspela prijava",
  LOGOUT: "Odjava",
  CREATE: "Ustvarjeno",
  UPDATE: "Spremenjeno",
  DELETE: "Izbrisano",
};

export const ENTITY_LABELS: Record<string, string> = {
  Vehicle: "Vozilo",
  Driver: "Voznik",
  VehicleGroup: "Skupina vozil",
  User: "Uporabnik",
  Device: "Naprava",
  Tenant: "Podjetje",
  PotniNalog: "Potni nalog",
  TachoFile: "Tahografska datoteka",
  Session: "Seja (prijava/odjava)",
};
