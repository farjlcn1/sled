import "server-only";
import { prisma } from "@/lib/db";
import { computeHistoryRows } from "@/lib/history-data";

export type GpsSuggestion = {
  actualDepartureAt: string;
  actualReturnAt: string;
  startOdometerKm: number | null;
  endOdometerKm: number | null;
  actualDistanceKm: number | null;
} | null;

// Predlaga dejanske podatke potnega naloga (odhod/prihod, stanje števca, razdalja) iz GPS/CAN
// telemetrije vozila v planiranem obdobju — uporabnik jih lahko pred shranitvijo še popravi.
export async function suggestActualFromGps(
  vehicle: { id: string; device: { traccarDeviceId: number | null } | null },
  fromDate: Date,
  toDate: Date
): Promise<GpsSuggestion> {
  const rows = await computeHistoryRows(vehicle, fromDate, toDate);
  if (rows.length === 0) return null;

  const first = rows[0];
  const last = rows[rows.length - 1];
  const startOdometerRaw = first.odometer;
  const endOdometerRaw = last.odometer;
  const startOdometerKm = typeof startOdometerRaw === "number" ? Math.round(startOdometerRaw / 100) / 10 : null;
  const endOdometerKm = typeof endOdometerRaw === "number" ? Math.round(endOdometerRaw / 100) / 10 : null;

  return {
    actualDepartureAt: first.fixTime,
    actualReturnAt: last.fixTime,
    startOdometerKm,
    endOdometerKm,
    actualDistanceKm: startOdometerKm !== null && endOdometerKm !== null ? Math.round((endOdometerKm - startOdometerKm) * 10) / 10 : null,
  };
}

// Zaporedna številka znotraj podjetja in leta, npr. "PN-2026-0001" — SRS 21 zahteva zaporednost,
// da listina velja kot verodostojna (ne sme biti naknadno konstruirana).
export async function nextPotniNalogNumber(tenantId: string, year: number): Promise<string> {
  const prefix = `PN-${year}-`;
  const count = await prisma.potniNalog.count({
    where: { tenantId, number: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}
