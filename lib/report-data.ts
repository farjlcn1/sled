import "server-only";
import { prisma } from "@/lib/db";
import { getTraccarRoute, type TraccarPosition } from "@/lib/traccar";
import { summarizeRoute, type RouteSummary } from "@/lib/trips";
import { applyPrivacyRedaction } from "@/lib/privacy";

export type VehicleReportInput = {
  id: string;
  plate: string;
  minStopDurationMin: number;
  minMovingSpeedKmh: number;
  device: { traccarDeviceId: number | null } | null;
};

export type VehicleReportResult =
  | {
      ok: true;
      plate: string;
      summary: RouteSummary;
      positions: TraccarPosition[];
      privateDistanceKm: number;
      hadPrivatePeriods: boolean;
    }
  | { ok: false; plate: string; error: string };

export async function computeVehicleReport(
  vehicle: VehicleReportInput,
  fromDate: Date,
  toDate: Date
): Promise<VehicleReportResult> {
  if (!vehicle.device?.traccarDeviceId) {
    return { ok: false, plate: vehicle.plate, error: "Vozilo nima povezane naprave." };
  }

  const rawPositions = await getTraccarRoute(vehicle.device.traccarDeviceId, fromDate, toDate);

  const privacyPeriods = await prisma.vehiclePrivacyPeriod.findMany({
    where: {
      vehicleId: vehicle.id,
      startedAt: { lte: toDate },
      OR: [{ endedAt: null }, { endedAt: { gte: fromDate } }],
    },
    select: { startedAt: true, endedAt: true, retentionTier: true },
  });

  const { positions, privateDistanceKm } = applyPrivacyRedaction(rawPositions, privacyPeriods, toDate);
  const summary = summarizeRoute(positions, {
    minMovingSpeedKmh: vehicle.minMovingSpeedKmh,
    minStopDurationMin: vehicle.minStopDurationMin,
  });

  return {
    ok: true,
    plate: vehicle.plate,
    summary,
    positions,
    privateDistanceKm,
    hadPrivatePeriods: privacyPeriods.length > 0,
  };
}
