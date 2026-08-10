import "server-only";
import { prisma } from "@/lib/db";
import { getTraccarRoute } from "@/lib/traccar";
import { applyPrivacyRedaction } from "@/lib/privacy";

export type HistoryRow = { fixTime: string } & Record<string, unknown>;

export type HistoryVehicleInput = {
  id: string;
  device: { traccarDeviceId: number | null } | null;
};

export async function computeHistoryRows(
  vehicle: HistoryVehicleInput,
  fromDate: Date,
  toDate: Date
): Promise<HistoryRow[]> {
  if (!vehicle.device?.traccarDeviceId) return [];

  const rawPositions = await getTraccarRoute(vehicle.device.traccarDeviceId, fromDate, toDate);

  const privacyPeriods = await prisma.vehiclePrivacyPeriod.findMany({
    where: {
      vehicleId: vehicle.id,
      startedAt: { lte: toDate },
      OR: [{ endedAt: null }, { endedAt: { gte: fromDate } }],
    },
    select: { startedAt: true, endedAt: true, retentionTier: true },
  });
  const { positions } = applyPrivacyRedaction(rawPositions, privacyPeriods, toDate);

  return positions.map((p) => ({
    fixTime: p.fixTime,
    ...p.attributes,
    latitude: p.latitude,
    longitude: p.longitude,
    speed: Math.round(p.speed * 1.852 * 10) / 10,
    course: p.course,
  }));
}

// Konec dneva (23:59:59.999) izbranega "do" datuma, kot se uporablja povsod v aplikaciji.
export function endOfDay(dateStr: string): Date {
  return new Date(new Date(dateStr).getTime() + 24 * 60 * 60 * 1000 - 1);
}
