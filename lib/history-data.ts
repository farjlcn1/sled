import "server-only";
import { prisma } from "@/lib/db";
import { getTraccarRoute } from "@/lib/traccar";
import { applyPrivacyRedaction } from "@/lib/privacy";
import { reverseGeocodeKey, reverseGeocodeMany } from "@/lib/photon";

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

// Dodaten korak, ne del computeHistoryRows samega -- klicatelji kot potni-nalog.ts (samo prva/
// zadnja točka) in zemljevid/izvoz (izvoz brez potrebe po naslovu) tega dodatnega Photon klica
// na vrstico ne potrebujejo, zato ga doda samo zemljevid/page.tsx, kjer se naslov res prikaže.
export async function attachAddresses(rows: HistoryRow[]): Promise<HistoryRow[]> {
  const points = rows
    .map((r) => ({ lat: Number(r.latitude), lon: Number(r.longitude) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  const addressByKey = await reverseGeocodeMany(points);

  return rows.map((r) => {
    const lat = Number(r.latitude);
    const lon = Number(r.longitude);
    const naslov = Number.isFinite(lat) && Number.isFinite(lon) ? (addressByKey.get(reverseGeocodeKey(lat, lon)) ?? null) : null;
    return { ...r, naslov };
  });
}

// Konec dneva (23:59:59.999) izbranega "do" datuma, kot se uporablja povsod v aplikaciji.
export function endOfDay(dateStr: string): Date {
  return new Date(new Date(dateStr).getTime() + 24 * 60 * 60 * 1000 - 1);
}
