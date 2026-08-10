import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { vehicleWhereForUser } from "@/lib/vehicle-access";
import { VehiclesPanel } from "./vehicles-panel";
import { VehicleHistoryTable } from "./vehicle-history-table";
import { computeHistoryRows, endOfDay, type HistoryRow } from "@/lib/history-data";
import { deriveVehicleStatus, type VehicleStatus } from "@/lib/vehicle-status";

export default async function ZemljevidPage({
  searchParams,
}: {
  searchParams: Promise<{ vozilo?: string; from?: string; to?: string }>;
}) {
  const user = await requireUser();
  const isPlatformAdmin = user.canManagePlatform;
  const { vozilo: selectedVehicleId, from, to } = await searchParams;

  const vehicles = await prisma.vehicle.findMany({
    where: vehicleWhereForUser(user),
    orderBy: { plate: "asc" },
    include: { device: true, currentDriver: true, tenant: true },
  });

  const selectedVehicle = selectedVehicleId ? vehicles.find((v) => v.id === selectedVehicleId) : undefined;

  let historyRows: HistoryRow[] = [];
  let historyError: string | null = null;
  let lastStatus: VehicleStatus = "unknown";

  if (selectedVehicle && from && to) {
    if (!selectedVehicle.device?.traccarDeviceId) {
      historyError = "Izbrano vozilo nima povezane naprave.";
    } else {
      const fromDate = new Date(from);
      const toDate = endOfDay(to);
      historyRows = await computeHistoryRows(selectedVehicle, fromDate, toDate);

      const lastRow = historyRows[historyRows.length - 1];
      if (lastRow) lastStatus = deriveVehicleStatus(lastRow);
    }
  }

  const historyRoute =
    !historyError && historyRows.length > 0 && selectedVehicle
      ? {
          path: historyRows.map((r) => [r.longitude as number, r.latitude as number] as [number, number]),
          plate: selectedVehicle.plate,
          icon: selectedVehicle.icon,
          status: lastStatus,
        }
      : null;

  return (
    <div className="space-y-6">
      <VehiclesPanel
        vehicles={vehicles.map((v) => ({
          id: v.id,
          plate: v.plate,
          brandModel: [v.brand, v.model].filter(Boolean).join(" ") || "—",
          driverName: v.currentDriver?.fullName ?? null,
          icon: v.icon,
          nextServiceDate: v.nextServiceDate?.toISOString() ?? null,
        }))}
        selectedVehicleId={selectedVehicleId}
        historyRoute={historyRoute}
      />

      {selectedVehicle && from && to && (
        <div className="space-y-4 rounded-md border border-gray-200 p-4 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Registrska: </span>
              <span className="text-gray-900 dark:text-gray-100">{selectedVehicle.plate}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Znamka/model: </span>
              <span className="text-gray-900 dark:text-gray-100">
                {[selectedVehicle.brand, selectedVehicle.model].filter(Boolean).join(" ") || "—"}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Letnik: </span>
              <span className="text-gray-900 dark:text-gray-100">{selectedVehicle.year ?? "—"}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Voznik: </span>
              <span className="text-gray-900 dark:text-gray-100">{selectedVehicle.currentDriver?.fullName ?? "—"}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Datum registracije: </span>
              <span className="text-gray-900 dark:text-gray-100">
                {selectedVehicle.registrationDate ? new Date(selectedVehicle.registrationDate).toLocaleDateString("sl-SI") : "—"}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Naslednji servis: </span>
              <span className="text-gray-900 dark:text-gray-100">
                {selectedVehicle.nextServiceDate ? new Date(selectedVehicle.nextServiceDate).toLocaleDateString("sl-SI") : "—"}
              </span>
            </div>
            {isPlatformAdmin && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Podjetje: </span>
                <span className="text-gray-900 dark:text-gray-100">{selectedVehicle.tenant.name}</span>
              </div>
            )}
            {selectedVehicle.note && (
              <div className="col-span-2">
                <span className="text-gray-500 dark:text-gray-400">Opomba: </span>
                <span className="text-gray-900 dark:text-gray-100">{selectedVehicle.note}</span>
              </div>
            )}
          </div>

          {historyError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{historyError}</p>
          ) : (
            <VehicleHistoryTable
              key={`${selectedVehicle.id}-${from}-${to}`}
              rows={historyRows}
              initialVisibleFields={user.visibleVehicleFields}
              exportHref={`/api/zemljevid/izvoz?vozilo=${selectedVehicle.id}&from=${from}&to=${to}`}
            />
          )}
        </div>
      )}
    </div>
  );
}
