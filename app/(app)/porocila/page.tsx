import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { vehicleWhereForUser } from "@/lib/vehicle-access";
import { computeVehicleReport, type VehicleReportResult } from "@/lib/report-data";
import {
  computeFuelReport,
  computeSpeedReport,
  computeEcoReport,
  computeAllDataRows,
  collectDataKeys,
  type ReportType,
} from "@/lib/report-types";
import { ReportForm } from "./report-form";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("sl-SI", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function fmtTimeSec(iso: string) {
  return new Date(iso).toLocaleString("sl-SI", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</div>
    </div>
  );
}

function PrivacyNote({ report }: { report: VehicleReportResult & { ok: true } }) {
  if (!report.hadPrivatePeriods) return null;
  return (
    <p className="text-xs text-gray-500 dark:text-gray-400">
      V izbranem obdobju je bilo vozilo del časa v zasebnem načinu — potek teh voženj ni prikazan.
      {report.privateDistanceKm > 0 &&
        ` Prevoženih ${report.privateDistanceKm} km v zasebnem času je vseeno vštetih v skupno razdaljo.`}
    </p>
  );
}

function VoznjeSection({ report }: { report: VehicleReportResult & { ok: true } }) {
  return (
    <>
      <PrivacyNote report={report} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile label="Prevoženo" value={`${(report.summary.totalDistanceKm + report.privateDistanceKm).toFixed(1)} km`} />
        <Tile label="Čas vožnje" value={`${Math.round(report.summary.totalDrivingMin / 60)} h`} />
        <Tile label="Št. voženj" value={String(report.summary.trips.length)} />
      </div>
      <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Začetek</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Konec</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Trajanje</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Razdalja</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Najv. hitrost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {report.summary.trips.map((t, i) => (
              <tr key={i}>
                <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{fmtTime(t.startTime)}</td>
                <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{fmtTime(t.endTime)}</td>
                <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{Math.round(t.durationMin)} min</td>
                <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{t.distanceKm.toFixed(1)} km</td>
                <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{Math.round(t.maxSpeedKmh)} km/h</td>
              </tr>
            ))}
            {report.summary.trips.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  Ni voženj v izbranem obdobju.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PostankiSection({ report }: { report: VehicleReportResult & { ok: true } }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile label="Št. postankov" value={String(report.summary.stops.length)} />
        <Tile label="Čas postankov" value={`${Math.round(report.summary.totalStoppedMin / 60)} h`} />
      </div>
      <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Začetek</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Konec</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Trajanje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {report.summary.stops.map((s, i) => (
              <tr key={i}>
                <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{fmtTime(s.startTime)}</td>
                <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{fmtTime(s.endTime)}</td>
                <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                  {s.durationMin >= 60 ? `${(s.durationMin / 60).toFixed(1)} h` : `${Math.round(s.durationMin)} min`}
                </td>
              </tr>
            ))}
            {report.summary.stops.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  Ni postankov v izbranem obdobju.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function GorivoSection({ report }: { report: VehicleReportResult & { ok: true } }) {
  const fuel = computeFuelReport(report.positions);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile label="Na začetku" value={fuel.startPct !== null ? `${fuel.startPct} %` : "—"} />
        <Tile label="Na koncu" value={fuel.endPct !== null ? `${fuel.endPct} %` : "—"} />
        <Tile label="Sprememba" value={fuel.usedPct !== null ? `${fuel.usedPct} %` : "—"} />
      </div>

      {fuel.drops.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Sumljivi padci goriva ({fuel.drops.length})
          </h3>
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            Padec goriva ≥ 8 % v manj kot 30 minutah — možen znak iztoka ali napake senzorja, ne nujno tatvine.
          </p>
          <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Od</th>
                  <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Do</th>
                  <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Sprememba</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {fuel.drops.map((d, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                      {fmtTimeSec(d.fromTime)} ({d.fromPct} %)
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                      {fmtTimeSec(d.toTime)} ({d.toPct} %)
                    </td>
                    <td className="px-3 py-2 text-sm text-red-600 dark:text-red-400">-{d.deltaPct} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Meritve goriva ({fuel.readings.length})</h3>
        <div className="max-h-96 overflow-auto rounded-md border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Čas</th>
                <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Gorivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {fuel.readings.map((r, i) => (
                <tr key={i}>
                  <td className="px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100">{fmtTimeSec(r.time)}</td>
                  <td className="px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100">{r.fuelPct} %</td>
                </tr>
              ))}
              {fuel.readings.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    Naprava ne pošilja podatkov o gorivu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function HitrostSection({ report }: { report: VehicleReportResult & { ok: true } }) {
  const speed = computeSpeedReport(report.positions, report.summary.trips);
  const maxBucket = Math.max(1, ...speed.buckets.map((b) => b.count));
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile label="Najvišja hitrost" value={`${speed.maxSpeedKmh} km/h`} />
        <Tile label="Povprečna hitrost (med vožnjo)" value={`${speed.avgMovingSpeedKmh} km/h`} />
        <Tile label={`Prekoračitve (>${speed.overspeedThresholdKmh} km/h)`} value={String(speed.overspeedEvents.length)} />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Porazdelitev hitrosti</h3>
        <div className="space-y-1">
          {speed.buckets.map((b) => (
            <div key={b.label} className="flex items-center gap-2 text-xs">
              <span className="w-24 shrink-0 text-gray-500 dark:text-gray-400">{b.label}</span>
              <div className="h-3 flex-1 rounded bg-gray-100 dark:bg-gray-800">
                <div
                  className="h-3 rounded bg-blue-500"
                  style={{ width: `${Math.max(2, (b.count / maxBucket) * 100)}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-gray-500 dark:text-gray-400">{b.count}</span>
            </div>
          ))}
        </div>
      </div>

      {speed.overspeedEvents.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Prekoračitve hitrosti ({speed.overspeedEvents.length})
          </h3>
          <div className="max-h-72 overflow-auto rounded-md border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Čas</th>
                  <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Hitrost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {speed.overspeedEvents.map((e, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100">{fmtTimeSec(e.time)}</td>
                    <td className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400">{e.speedKmh} km/h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Hitrost po vožnjah</h3>
        <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Začetek</th>
                <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Konec</th>
                <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Povp. hitrost</th>
                <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Najv. hitrost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {speed.tripSpeeds.map((t, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{fmtTime(t.startTime)}</td>
                  <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{fmtTime(t.endTime)}</td>
                  <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{t.avgSpeedKmh} km/h</td>
                  <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{t.maxSpeedKmh} km/h</td>
                </tr>
              ))}
              {speed.tripSpeeds.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    Ni voženj v izbranem obdobju.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function EkoSection({
  report,
  fuelTankVolumeL,
}: {
  report: VehicleReportResult & { ok: true };
  fuelTankVolumeL: number | null;
}) {
  const eco = computeEcoReport(report.positions, {
    distanceKm: report.summary.totalDistanceKm,
    drivingMin: report.summary.totalDrivingMin,
    fuelUsedPct: report.summary.fuelUsedPct,
    fuelTankVolumeL,
  });
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Čas mirovanja z vklopljenim motorjem" value={`${Math.round(eco.idlingMin)} min`} />
        <Tile label="Sunkovite spremembe hitrosti" value={String(eco.harshEventsCount)} />
        <Tile label="Poraba" value={eco.fuelPer100km !== null ? `${eco.fuelPer100km} L/100km` : "—"} />
        <Tile label="Prevoženo" value={`${eco.distanceKm.toFixed(1)} km`} />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Sunkovite spremembe hitrosti so ocenjene iz GPS podatkov (sprememba &gt; 25 km/h med dvema zaporednima
        točkama v manj kot 20 s) — ne gre za meritev pravega pospeškometra, zato je ocena približna. Poraba na 100
        km je izračunana iz spremembe nivoja goriva in volumna rezervoarja vozila
        {fuelTankVolumeL === null && " (rezervoar ni nastavljen, zato izračun ni na voljo)"}.
      </p>
    </>
  );
}

function VseSection({ report }: { report: VehicleReportResult & { ok: true } }) {
  const rows = computeAllDataRows(report.positions);
  const keys = collectDataKeys(rows);
  return (
    <>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Vse surove podatkovne točke ({rows.length}), z vsemi parametri, ki jih naprava pošilja.
      </p>
      <div className="max-h-[32rem] overflow-auto rounded-md border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Čas</th>
              {keys.map((k) => (
                <th key={k} className="whitespace-nowrap px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="whitespace-nowrap px-3 py-1.5 text-gray-900 dark:text-gray-100">{fmtTimeSec(row.fixTime)}</td>
                {keys.map((k) => (
                  <td key={k} className="whitespace-nowrap px-3 py-1.5 text-gray-900 dark:text-gray-100">
                    {typeof row[k] === "boolean" ? (row[k] ? "Da" : "Ne") : row[k] == null ? "—" : String(row[k])}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={keys.length + 1} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                  Ni podatkov v izbranem obdobju.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function VehicleReportSection({
  report,
  type,
  fuelTankVolumeL,
}: {
  report: VehicleReportResult;
  type: ReportType;
  fuelTankVolumeL: number | null;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">{report.plate}</h2>
      {!report.ok ? (
        <p className="text-sm text-red-600 dark:text-red-400">{report.error}</p>
      ) : type === "postanki" ? (
        <PostankiSection report={report} />
      ) : type === "gorivo" ? (
        <GorivoSection report={report} />
      ) : type === "hitrost" ? (
        <HitrostSection report={report} />
      ) : type === "eko" ? (
        <EkoSection report={report} fuelTankVolumeL={fuelTankVolumeL} />
      ) : type === "vse" ? (
        <VseSection report={report} />
      ) : (
        <VoznjeSection report={report} />
      )}
    </div>
  );
}

export default async function PorocilaPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicleId?: string; groupId?: string; tip?: string; from?: string; to?: string }>;
}) {
  const user = await requirePermission("canViewReports");
  const { vehicleId, groupId, tip, from, to } = await searchParams;
  const reportType: ReportType = (
    ["voznje", "postanki", "gorivo", "hitrost", "eko", "vse"] as const
  ).includes(tip as ReportType)
    ? (tip as ReportType)
    : "voznje";

  const [vehicles, groups] = await Promise.all([
    prisma.vehicle.findMany({
      where: { ...vehicleWhereForUser(user), device: { isNot: null } },
      orderBy: { plate: "asc" },
      select: {
        id: true,
        plate: true,
        minStopDurationMin: true,
        minMovingSpeedKmh: true,
        fuelTankVolumeL: true,
        device: { select: { traccarDeviceId: true } },
      },
    }),
    prisma.vehicleGroup.findMany({
      where: user.canManagePlatform ? {} : { tenantId: user.tenantId ?? "__none__" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const fromDate = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const toDate = to ? new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1) : new Date();

  let reports: VehicleReportResult[] = [];
  let fuelTankByPlate = new Map<string, number | null>();
  let rangeError: string | null = null;
  let exportHref: string | null = null;

  if (groupId) {
    const groupVehicles = await prisma.vehicle.findMany({
      where: { ...vehicleWhereForUser(user), groupMemberships: { some: { groupId } } },
      orderBy: { plate: "asc" },
      select: {
        id: true,
        plate: true,
        minStopDurationMin: true,
        minMovingSpeedKmh: true,
        fuelTankVolumeL: true,
        device: { select: { traccarDeviceId: true } },
      },
    });
    if (groupVehicles.length === 0) {
      rangeError = "V tej skupini ni dostopnih vozil.";
    } else {
      reports = await Promise.all(groupVehicles.map((v) => computeVehicleReport(v, fromDate, toDate)));
      fuelTankByPlate = new Map(groupVehicles.map((v) => [v.plate, v.fuelTankVolumeL]));
      exportHref = `/api/porocila/izvoz?groupId=${groupId}&tip=${reportType}&from=${from ?? ""}&to=${to ?? ""}`;
    }
  } else if (vehicleId) {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) {
      rangeError = "Izbrano vozilo ni na voljo.";
    } else {
      reports = [await computeVehicleReport(vehicle, fromDate, toDate)];
      fuelTankByPlate = new Map([[vehicle.plate, vehicle.fuelTankVolumeL]]);
      exportHref = `/api/porocila/izvoz?vehicleId=${vehicleId}&tip=${reportType}&from=${from ?? ""}&to=${to ?? ""}`;
    }
  }

  return (
    <div className="space-y-6">
      <ReportForm
        vehicles={vehicles}
        groups={groups}
        selectedVehicleId={vehicleId}
        selectedGroupId={groupId}
        selectedType={reportType}
        from={from}
        to={to}
      />

      {rangeError && <p className="text-sm text-red-600 dark:text-red-400">{rangeError}</p>}

      {exportHref && reports.length > 0 && (
        <a
          href={exportHref}
          className="inline-block rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Izvozi v XLSX
        </a>
      )}

      {reports.map((report, i) => (
        <VehicleReportSection
          key={i}
          report={report}
          type={reportType}
          fuelTankVolumeL={fuelTankByPlate.get(report.plate) ?? null}
        />
      ))}
    </div>
  );
}
