import "server-only";
import type { TraccarPosition } from "@/lib/traccar";
import type { Trip } from "@/lib/trips";

export type { ReportType } from "@/lib/report-type-options";

function sortedByTime(positions: TraccarPosition[]): TraccarPosition[] {
  return [...positions].sort((a, b) => new Date(a.fixTime).getTime() - new Date(b.fixTime).getTime());
}

// Padec goriva, ki v kratkem času ni pojasnjen s prevoženo razdaljo — možno kaže na iztok/tatvino.
const SUSPICIOUS_DROP_PCT = 8;
const SUSPICIOUS_DROP_WINDOW_MIN = 30;

export type FuelReport = {
  readings: { time: string; fuelPct: number }[];
  drops: { fromTime: string; toTime: string; fromPct: number; toPct: number; deltaPct: number }[];
  startPct: number | null;
  endPct: number | null;
  usedPct: number | null;
};

export function computeFuelReport(positions: TraccarPosition[]): FuelReport {
  const sorted = sortedByTime(positions).filter((p) => typeof p.attributes.fuel === "number");
  const readings = sorted.map((p) => ({ time: p.fixTime, fuelPct: p.attributes.fuel as number }));

  const drops: FuelReport["drops"] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const prevFuel = prev.attributes.fuel as number;
    const curFuel = cur.attributes.fuel as number;
    const gapMin = (new Date(cur.fixTime).getTime() - new Date(prev.fixTime).getTime()) / 60000;
    const delta = prevFuel - curFuel;
    if (delta >= SUSPICIOUS_DROP_PCT && gapMin <= SUSPICIOUS_DROP_WINDOW_MIN) {
      drops.push({ fromTime: prev.fixTime, toTime: cur.fixTime, fromPct: prevFuel, toPct: curFuel, deltaPct: Math.round(delta * 10) / 10 });
    }
  }

  const startPct = readings[0]?.fuelPct ?? null;
  const endPct = readings[readings.length - 1]?.fuelPct ?? null;
  const usedPct = startPct !== null && endPct !== null ? Math.round((startPct - endPct) * 10) / 10 : null;

  return { readings, drops, startPct, endPct, usedPct };
}

const OVERSPEED_THRESHOLD_KMH = 130;
const SPEED_BUCKETS = [
  { label: "0–50 km/h", min: 0, max: 50 },
  { label: "50–90 km/h", min: 50, max: 90 },
  { label: "90–110 km/h", min: 90, max: 110 },
  { label: "110–130 km/h", min: 110, max: 130 },
  { label: "130+ km/h", min: 130, max: Infinity },
];

export type SpeedReport = {
  buckets: { label: string; count: number }[];
  maxSpeedKmh: number;
  avgMovingSpeedKmh: number;
  overspeedEvents: { time: string; speedKmh: number }[];
  overspeedThresholdKmh: number;
  tripSpeeds: { startTime: string; endTime: string; maxSpeedKmh: number; avgSpeedKmh: number }[];
};

export function computeSpeedReport(positions: TraccarPosition[], trips: Trip[]): SpeedReport {
  const moving = sortedByTime(positions).filter((p) => p.speed * 1.852 > 3); // izloči šum pri mirovanju
  const speedsKmh = moving.map((p) => p.speed * 1.852);

  const buckets = SPEED_BUCKETS.map((b) => ({
    label: b.label,
    count: speedsKmh.filter((s) => s >= b.min && s < b.max).length,
  }));

  const maxSpeedKmh = speedsKmh.length > 0 ? Math.round(Math.max(...speedsKmh)) : 0;
  const avgMovingSpeedKmh = speedsKmh.length > 0 ? Math.round(speedsKmh.reduce((a, b) => a + b, 0) / speedsKmh.length) : 0;

  const overspeedEvents = moving
    .filter((p) => p.speed * 1.852 > OVERSPEED_THRESHOLD_KMH)
    .map((p) => ({ time: p.fixTime, speedKmh: Math.round(p.speed * 1.852) }));

  const tripSpeeds = trips.map((t) => ({
    startTime: t.startTime,
    endTime: t.endTime,
    maxSpeedKmh: Math.round(t.maxSpeedKmh),
    avgSpeedKmh: Math.round(t.avgSpeedKmh),
  }));

  return { buckets, maxSpeedKmh, avgMovingSpeedKmh, overspeedEvents, overspeedThresholdKmh: OVERSPEED_THRESHOLD_KMH, tripSpeeds };
}

// Groba ocena "sunkovite" spremembe hitrosti iz GPS podatkov (ne dejanski pospeškometer) —
// zazna spremembo hitrosti > 25 km/h med dvema zaporednima točkama v manj kot 20s.
const HARSH_DELTA_KMH = 25;
const HARSH_WINDOW_SEC = 20;

export type EcoReport = {
  idlingMin: number;
  harshEventsCount: number;
  fuelPer100km: number | null;
  distanceKm: number;
  drivingMin: number;
};

export function computeEcoReport(
  positions: TraccarPosition[],
  opts: { distanceKm: number; drivingMin: number; fuelUsedPct: number | null; fuelTankVolumeL: number | null }
): EcoReport {
  const sorted = sortedByTime(positions);

  let idlingMin = 0;
  for (const p of sorted) {
    const ignition = p.attributes.ignition;
    const motion = p.attributes.motion;
    if (ignition === true && motion === false) idlingMin += 1; // groba ocena: ena pozicija ~ interval vzorčenja
  }
  // Pretvori v minute glede na dejanski povprečni interval vzorčenja, če je znan.
  if (sorted.length > 1) {
    const totalSpanMin = (new Date(sorted[sorted.length - 1].fixTime).getTime() - new Date(sorted[0].fixTime).getTime()) / 60000;
    const avgIntervalMin = totalSpanMin / (sorted.length - 1);
    idlingMin = Math.round(idlingMin * avgIntervalMin);
  }

  let harshEventsCount = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gapSec = (new Date(sorted[i].fixTime).getTime() - new Date(sorted[i - 1].fixTime).getTime()) / 1000;
    if (gapSec <= 0 || gapSec > HARSH_WINDOW_SEC) continue;
    const deltaKmh = Math.abs(sorted[i].speed * 1.852 - sorted[i - 1].speed * 1.852);
    if (deltaKmh >= HARSH_DELTA_KMH) harshEventsCount++;
  }

  const fuelPer100km =
    opts.fuelUsedPct !== null && opts.fuelTankVolumeL !== null && opts.distanceKm > 0
      ? Math.round(((opts.fuelUsedPct / 100) * opts.fuelTankVolumeL * 100) / opts.distanceKm * 10) / 10
      : null;

  return {
    idlingMin,
    harshEventsCount,
    fuelPer100km,
    distanceKm: opts.distanceKm,
    drivingMin: opts.drivingMin,
  };
}

export type AllDataRow = { fixTime: string } & Record<string, unknown>;

export function computeAllDataRows(positions: TraccarPosition[]): AllDataRow[] {
  return sortedByTime(positions).map((p) => ({
    fixTime: p.fixTime,
    ...p.attributes,
    latitude: p.latitude,
    longitude: p.longitude,
    speed: Math.round(p.speed * 1.852 * 10) / 10,
    course: p.course,
  }));
}

export function collectDataKeys(rows: AllDataRow[]): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (key !== "fixTime") keys.add(key);
    }
  }
  return Array.from(keys).sort();
}
