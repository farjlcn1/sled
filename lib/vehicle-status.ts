export type VehicleStatus = "driving" | "idle" | "parked" | "unknown";

// zelena (vožnja) / oranžna (ignition on, miruje) / rdeča (ignition off) — glede na zadnjo pozicijo.
export function deriveVehicleStatus(attributes: Record<string, unknown>): VehicleStatus {
  const ignition = attributes.ignition;
  const motion = attributes.motion;
  if (typeof motion === "boolean" && motion) return "driving";
  if (typeof ignition === "boolean") return ignition ? "idle" : "parked";
  return "unknown";
}
