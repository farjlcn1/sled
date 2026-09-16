export type VehicleStatus = "driving" | "idle" | "parked" | "unknown";

// Ista, umirjena paleta kot vehicle-card.tsx's STATUS_ICON_COLOR (ne rdeča-za-parkirano z zemljevida) —
// mini-zemljevidova pika ne sme nasprotovati statusnemu značku tik nad njo.
export const STATUS_DOT_COLOR: Record<VehicleStatus, string> = {
  driving: "#22c55e",
  idle: "#f97316",
  parked: "#9ca3af",
  unknown: "#9ca3af",
};

// zelena (vožnja) / oranžna (ignition on, miruje) / rdeča (ignition off) — glede na zadnjo pozicijo.
export function deriveVehicleStatus(attributes: Record<string, unknown>): VehicleStatus {
  const ignition = attributes.ignition;
  const motion = attributes.motion;
  if (typeof motion === "boolean" && motion) return "driving";
  if (typeof ignition === "boolean") return ignition ? "idle" : "parked";
  return "unknown";
}
