import type { TraccarPosition } from "@/lib/traccar";

export type PrivacyPeriod = {
  startedAt: Date;
  endedAt: Date | null;
  retentionTier: "BASIC" | "WITH_MILEAGE";
};

// Odstrani pozicije, ki sodijo v katerokoli zasebno obdobje vozila, iz podrobnega prikaza
// (koordinate/potek se ne prikažejo). Pri stopnji "WITH_MILEAGE" se prevoženi km v tem
// obdobju (iz razlike kilometrine) vseeno vštejejo v skupno razdaljo — samo pot se skrije.
export function applyPrivacyRedaction(
  positions: TraccarPosition[],
  periods: PrivacyPeriod[],
  rangeEnd: Date
): { positions: TraccarPosition[]; privateDistanceKm: number } {
  if (periods.length === 0) return { positions, privateDistanceKm: 0 };

  let privateDistanceKm = 0;
  const withinAnyPeriod = new Set<number>();

  for (const period of periods) {
    const start = period.startedAt.getTime();
    const end = (period.endedAt ?? rangeEnd).getTime();

    const withinPeriod = positions.filter((p) => {
      const t = new Date(p.fixTime).getTime();
      return t >= start && t <= end;
    });
    withinPeriod.forEach((p) => withinAnyPeriod.add(p.id));

    if (period.retentionTier === "WITH_MILEAGE" && withinPeriod.length >= 2) {
      const firstOdo = withinPeriod[0].attributes.odometer;
      const lastOdo = withinPeriod[withinPeriod.length - 1].attributes.odometer;
      if (typeof firstOdo === "number" && typeof lastOdo === "number") {
        privateDistanceKm += Math.max(0, (lastOdo - firstOdo) / 1000);
      }
    }
  }

  return {
    positions: positions.filter((p) => !withinAnyPeriod.has(p.id)),
    privateDistanceKm: Math.round(privateDistanceKm * 10) / 10,
  };
}
