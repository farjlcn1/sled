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

// Delovne ure delovnega stroja (bager, traktor ...) -- GPS "vožnja" tu ni zanesljiv signal, ker
// stroj lahko dela (koplje, dviguje) povsem na mestu. Namesto tega gledamo pospeškometer (osi
// X/Y/Z, Teltonika AVL 17-19 -> attributes.axisX/Y/Z) -- sprememba vrednosti skozi 3 zaporedne
// poslane pozicije pomeni mehansko aktivnost stroja. "motion" štejemo zraven kot dodaten signal
// (npr. traktor, ki dejansko vozi med delom). To samo po sebi ne loči "stroj dela" od "stroj je
// naložen na prikolici in se trese med vožnjo" -- zato dodatno zahtevamo DIN1 (Teltonika AVL 1 ->
// attributes.in1): če ni true, sprememba šteje kot "premeščanje", ne kot delo.
export type DelovneUreReport = {
  workingMin: number;
  transportedMin: number;
  intervalsEvaluated: number;
};

function changedAcrossWindow(values: unknown[]): boolean {
  if (values.some((v) => typeof v !== "number")) return false;
  return new Set(values as number[]).size > 1;
}

export function computeDelovneUreReport(positions: TraccarPosition[]): DelovneUreReport {
  const sorted = sortedByTime(positions);

  let workingMs = 0;
  let transportedMs = 0;
  let intervalsEvaluated = 0;

  for (let i = 2; i < sorted.length; i++) {
    const p0 = sorted[i - 2];
    const p1 = sorted[i - 1];
    const p2 = sorted[i];

    const gapMs = new Date(p2.fixTime).getTime() - new Date(p1.fixTime).getTime();
    if (gapMs <= 0) continue;

    const axisChanged = (["axisX", "axisY", "axisZ"] as const).some((key) =>
      changedAcrossWindow([p0.attributes[key], p1.attributes[key], p2.attributes[key]])
    );
    const motionValues = [p0.attributes.motion, p1.attributes.motion, p2.attributes.motion];
    const motionChanged = motionValues.every((v) => typeof v === "boolean") && new Set(motionValues).size > 1;

    if (!axisChanged && !motionChanged) continue;

    intervalsEvaluated++;
    if (p2.attributes.in1 === true) {
      workingMs += gapMs;
    } else {
      transportedMs += gapMs;
    }
  }

  return {
    workingMin: Math.round(workingMs / 60000),
    transportedMin: Math.round(transportedMs / 60000),
    intervalsEvaluated,
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
