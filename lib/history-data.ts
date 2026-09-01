import "server-only";
import { prisma } from "@/lib/db";
import { getTraccarPositions, getTraccarRoute } from "@/lib/traccar";
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

// Kadar za izbrano obdobje ni nobene pozicije (naprava je bila tiho dlje kot izbrano obdobje),
// namesto prazne tabele poiščemo zadnjih 10 dejansko znanih pozicij, ne glede na njihovo starost
// -- sidrano na dejanski čas zadnje pozicije (last.fixTime), NE na "zdaj", iz istega razloga kot
// v app/api/vozila/[id]/status/route.ts: naprava, ki že dlje molči, sicer ne bi pokazala ničesar.
// Samo za prikaz/izvoz na zemljevidu -- lib/potni-nalog.ts mora ostati vezan natanko na izbrano
// obdobje potovanja, zato kliče computeHistoryRows neposredno, ne tega ovoja.
const FALLBACK_LOOKBACK_MS = 365 * 24 * 60 * 60 * 1000;

export async function computeHistoryRowsWithFallback(
  vehicle: HistoryVehicleInput,
  fromDate: Date,
  toDate: Date
): Promise<HistoryRow[]> {
  const rows = await computeHistoryRows(vehicle, fromDate, toDate);
  if (rows.length > 0 || !vehicle.device?.traccarDeviceId) return rows;

  const [last] = await getTraccarPositions([vehicle.device.traccarDeviceId]);
  if (!last) return rows;

  const anchor = new Date(new Date(last.fixTime).getTime() + 1000);
  const windowStart = new Date(anchor.getTime() - FALLBACK_LOOKBACK_MS);
  const fallbackRows = await computeHistoryRows(vehicle, windowStart, anchor);
  return fallbackRows.slice(-10);
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
