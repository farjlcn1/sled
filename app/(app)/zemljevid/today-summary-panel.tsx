"use client";

import { useEffect, useState } from "react";
import type { TodaySummary } from "@/app/api/vozila/[id]/danes/route";

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  );
}

export function TodaySummaryPanel({ vehicleId, plate }: { vehicleId: string; plate: string }) {
  const [data, setData] = useState<TodaySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    fetch(`/api/vozila/${vehicleId}/danes`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<TodaySummary>;
      })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setError("Podatkov trenutno ni mogoče prikazati.");
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  return (
    <div className="space-y-1 self-start rounded-md border border-gray-200 p-4 dark:border-gray-700">
      <h3 className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">Danes — {plate}</h3>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!data && !error && <p className="text-sm text-gray-500 dark:text-gray-400">Nalagam …</p>}
      {data && !data.ok && <p className="text-sm text-gray-500 dark:text-gray-400">{data.error}</p>}

      {data?.ok && (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          <StatRow label="Prevožena razdalja" value={`${data.summary.totalDistanceKm.toFixed(1)} km`} />
          <StatRow label="Čas vožnje" value={formatDuration(data.summary.totalDrivingMin)} />
          <StatRow label="Čas postankov" value={formatDuration(data.summary.totalStoppedMin)} />
          <StatRow label="Število voženj" value={String(data.summary.trips.length)} />
          <StatRow label="Število postankov" value={String(data.summary.stops.length)} />
          {data.summary.fuelUsedPct !== null && (
            <StatRow
              label="Sprememba goriva"
              value={`${data.summary.fuelUsedPct > 0 ? "-" : "+"}${Math.abs(data.summary.fuelUsedPct)} %`}
            />
          )}
          {data.summary.startOdometerKm !== null && data.summary.endOdometerKm !== null && (
            <StatRow
              label="Odometer"
              value={`${data.summary.startOdometerKm.toFixed(1)} → ${data.summary.endOdometerKm.toFixed(1)} km`}
            />
          )}
          {data.hadPrivatePeriods && (
            <p className="pt-2 text-xs text-gray-400 dark:text-gray-500">
              Del podatkov je lahko skrit zaradi zasebnega načina.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
