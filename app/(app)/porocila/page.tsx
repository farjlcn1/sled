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
import { VoznjeTable } from "./voznje-table";
import { PostankiTable } from "./postanki-table";
import { FuelDropsTable, FuelReadingsTable } from "./gorivo-tables";
import { OverspeedTable, TripSpeedsTable } from "./hitrost-tables";
import { VseTable } from "./vse-table";

// Če "do" nima izrecno nastavljene ure (privzeta polnoč ob izbiri samo dneva), ga obravnavamo
// kot vključno do konca tega dne — sicer bi izbira samo dneva brez ure izključila skoraj ves dan.
function inclusiveEnd(value: string): Date {
  const d = new Date(value);
  if (d.getHours() === 0 && d.getMinutes() === 0) d.setHours(23, 59, 59, 999);
  return d;
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
      <VoznjeTable trips={report.summary.trips} />
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
      <PostankiTable stops={report.summary.stops} />
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
          <FuelDropsTable drops={fuel.drops} />
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Meritve goriva ({fuel.readings.length})</h3>
        <FuelReadingsTable readings={fuel.readings} />
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
          <OverspeedTable events={speed.overspeedEvents} />
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Hitrost po vožnjah</h3>
        <TripSpeedsTable tripSpeeds={speed.tripSpeeds} />
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
      <VseTable rows={rows} keys={keys} />
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
  const toDate = to ? inclusiveEnd(to) : new Date();

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
        <div className="flex justify-end">
          <a
            href={exportHref}
            className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            Izvoz
          </a>
        </div>
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
