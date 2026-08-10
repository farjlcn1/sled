import type { TraccarPosition } from "@/lib/traccar";

export type Trip = {
  startTime: string;
  endTime: string;
  durationMin: number;
  distanceKm: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
};

export type Stop = {
  startTime: string;
  endTime: string;
  durationMin: number;
  lat: number;
  lon: number;
};

export type RouteSummary = {
  trips: Trip[];
  stops: Stop[];
  totalDistanceKm: number;
  totalDrivingMin: number;
  totalStoppedMin: number;
  fuelUsedPct: number | null;
  startOdometerKm: number | null;
  endOdometerKm: number | null;
};

export type StopDetectionSettings = {
  minMovingSpeedKmh: number;
  minStopDurationMin: number;
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dphi = ((lat2 - lat1) * Math.PI) / 180;
  const dlambda = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dlambda / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function isMoving(p: TraccarPosition, minMovingSpeedKmh: number): boolean {
  const motion = p.attributes.motion;
  if (typeof motion === "boolean") return motion;
  return p.speed * 1.852 > minMovingSpeedKmh; // vozli -> km/h
}

// Deli surove pozicije (urejene po času) v vožnje in postanke glede na "motion" atribut in
// nastavljive parametre vozila (razdelek 8 arhitekturnega načrta — nastavljivo po vozilu/podjetju).
// Vrzel med dvema "moving" točkama nad minStopDurationMin obravnavamo kot postanek, tudi če vmes
// ni izrecne "motion: false" točke — ščiti pred pravo izgubo GPRS signala v resničnem prometu.
export function summarizeRoute(positions: TraccarPosition[], settings: StopDetectionSettings): RouteSummary {
  const { minMovingSpeedKmh, minStopDurationMin } = settings;
  const sorted = [...positions].sort((a, b) => new Date(a.fixTime).getTime() - new Date(b.fixTime).getTime());

  const trips: Trip[] = [];
  const stops: Stop[] = [];
  let totalDistanceKm = 0;
  let i = 0;

  while (i < sorted.length) {
    const moving = isMoving(sorted[i], minMovingSpeedKmh);
    const segment: TraccarPosition[] = [sorted[i]];
    let j = i + 1;
    let gapBroke = false;
    while (j < sorted.length && isMoving(sorted[j], minMovingSpeedKmh) === moving) {
      const gapMin = (new Date(sorted[j].fixTime).getTime() - new Date(sorted[j - 1].fixTime).getTime()) / 60000;
      if (moving && gapMin > minStopDurationMin) {
        gapBroke = true;
        break;
      }
      segment.push(sorted[j]);
      j++;
    }

    const first = segment[0];
    const last = segment[segment.length - 1];
    const durationMin = (new Date(last.fixTime).getTime() - new Date(first.fixTime).getTime()) / 60000;

    if (moving) {
      let distanceKm = 0;
      let maxSpeedKmh = 0;
      for (let k = 1; k < segment.length; k++) {
        distanceKm += haversineKm(segment[k - 1].latitude, segment[k - 1].longitude, segment[k].latitude, segment[k].longitude);
        maxSpeedKmh = Math.max(maxSpeedKmh, segment[k].speed * 1.852);
      }
      totalDistanceKm += distanceKm;
      trips.push({
        startTime: first.fixTime,
        endTime: last.fixTime,
        durationMin,
        distanceKm,
        maxSpeedKmh,
        avgSpeedKmh: durationMin > 0 ? distanceKm / (durationMin / 60) : 0,
        startLat: first.latitude,
        startLon: first.longitude,
        endLat: last.latitude,
        endLon: last.longitude,
      });
    } else if (durationMin >= minStopDurationMin || sorted.length === 1) {
      stops.push({
        startTime: first.fixTime,
        endTime: last.fixTime,
        durationMin,
        lat: first.latitude,
        lon: first.longitude,
      });
    }

    if (gapBroke) {
      const gapEnd = sorted[j];
      stops.push({
        startTime: last.fixTime,
        endTime: gapEnd.fixTime,
        durationMin: (new Date(gapEnd.fixTime).getTime() - new Date(last.fixTime).getTime()) / 60000,
        lat: last.latitude,
        lon: last.longitude,
      });
    }

    i = j;
  }

  stops.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const totalDrivingMin = trips.reduce((sum, t) => sum + t.durationMin, 0);
  const totalStoppedMin = stops.reduce((sum, s) => sum + s.durationMin, 0);

  const firstFuel = sorted[0]?.attributes.fuel;
  const lastFuel = sorted[sorted.length - 1]?.attributes.fuel;
  const fuelUsedPct =
    typeof firstFuel === "number" && typeof lastFuel === "number" ? Math.round((firstFuel - lastFuel) * 10) / 10 : null;

  const firstOdo = sorted[0]?.attributes.odometer;
  const lastOdo = sorted[sorted.length - 1]?.attributes.odometer;
  const startOdometerKm = typeof firstOdo === "number" ? Math.round(firstOdo / 100) / 10 : null;
  const endOdometerKm = typeof lastOdo === "number" ? Math.round(lastOdo / 100) / 10 : null;

  return { trips, stops, totalDistanceKm, totalDrivingMin, totalStoppedMin, fuelUsedPct, startOdometerKm, endOdometerKm };
}
