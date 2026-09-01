import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { vehicleWhereForUser } from "@/lib/vehicle-access";
import { VehiclesPanel, type SelectionData } from "./vehicles-panel";
import { computeHistoryRowsWithFallback, attachAddresses, type HistoryRow } from "@/lib/history-data";
import { deriveVehicleStatus, type VehicleStatus } from "@/lib/vehicle-status";

// Če "do" nima izrecno nastavljene ure (privzeta polnoč ob izbiri samo dneva), ga obravnavamo
// kot vključno do konca tega dne — sicer bi izbira samo dneva brez ure izključila skoraj ves dan.
function inclusiveEnd(value: string): Date {
  const d = new Date(value);
  if (d.getHours() === 0 && d.getMinutes() === 0) d.setHours(23, 59, 59, 999);
  return d;
}

export default async function ZemljevidPage({
  searchParams,
}: {
  searchParams: Promise<{ vozilo?: string; from?: string; to?: string }>;
}) {
  const user = await requireUser();
  const { vozilo, from, to } = await searchParams;
  const selectedVehicleIds = vozilo ? vozilo.split(",").filter(Boolean) : [];

  const [vehicles, groups] = await Promise.all([
    prisma.vehicle.findMany({
      where: vehicleWhereForUser(user),
      orderBy: { plate: "asc" },
      include: { device: true, currentDriver: true, tenant: true },
    }),
    prisma.vehicleGroup.findMany({
      where: user.tenantId ? { tenantId: user.tenantId } : {},
      orderBy: { name: "asc" },
      include: { vehicles: { select: { vehicleId: true } } },
    }),
  ]);

  // Arhivska skupina (glej isArchiveGroup) loči vozila brez naprave, ki so bila namerno
  // arhivirana (zavihek "Arhiv"), od preostalih -- ki ostanejo pod "Vozila" tudi če trenutno
  // nimajo naprave (npr. še niso bila povezana). Sama skupina se v zavihku "Skupine" ne prikaže,
  // ima svoj namenski zavihek.
  const archiveGroup = groups.find((g) => g.isArchiveGroup) ?? null;
  const archivedVehicleIds = new Set(archiveGroup?.vehicles.map((m) => m.vehicleId) ?? []);
  const activeVehicles = vehicles.filter((v) => !archivedVehicleIds.has(v.id));
  const archivedVehicles = vehicles.filter((v) => archivedVehicleIds.has(v.id));
  const visibleGroups = groups.filter((g) => !g.isArchiveGroup);

  function toVehicleListItem(v: (typeof vehicles)[number]) {
    return {
      id: v.id,
      plate: v.plate,
      brandModel: [v.brand, v.model].filter(Boolean).join(" ") || "—",
      driverName: v.currentDriver?.fullName ?? null,
      icon: v.icon,
      year: v.year,
      registrationDate: v.registrationDate?.toISOString() ?? null,
      nextServiceDate: v.nextServiceDate?.toISOString() ?? null,
      note: v.note,
      deviceId: v.deviceId,
    };
  }

  const selectedVehicles = vehicles.filter((v) => selectedVehicleIds.includes(v.id));

  type Selection = {
    vehicle: (typeof vehicles)[number];
    rows: HistoryRow[];
    error: string | null;
    status: VehicleStatus;
  };

  let selections: Selection[] = [];
  if (selectedVehicles.length > 0 && from && to) {
    const fromDate = new Date(from);
    const toDate = inclusiveEnd(to);

    selections = await Promise.all(
      selectedVehicles.map(async (vehicle): Promise<Selection> => {
        if (!vehicle.device?.traccarDeviceId) {
          return { vehicle, rows: [], error: "Vozilo nima povezane naprave.", status: "unknown" };
        }
        const rows = await attachAddresses(await computeHistoryRowsWithFallback(vehicle, fromDate, toDate));
        const lastRow = rows[rows.length - 1];
        return { vehicle, rows, error: null, status: lastRow ? deriveVehicleStatus(lastRow) : "unknown" };
      })
    );
  }

  const selectionData: SelectionData[] = selections.map((s) => ({
    vehicleId: s.vehicle.id,
    plate: s.vehicle.plate,
    icon: s.vehicle.icon,
    brandModel: [s.vehicle.brand, s.vehicle.model].filter(Boolean).join(" ") || "—",
    year: s.vehicle.year,
    driverName: s.vehicle.currentDriver?.fullName ?? null,
    registrationDate: s.vehicle.registrationDate?.toISOString() ?? null,
    nextServiceDate: s.vehicle.nextServiceDate?.toISOString() ?? null,
    note: s.vehicle.note,
    status: s.status,
    rows: s.rows,
    error: s.error,
    from: from ?? "",
    to: to ?? "",
  }));

  return (
    <VehiclesPanel
      vehicles={activeVehicles.map(toVehicleListItem)}
      archivedVehicles={archivedVehicles.map(toVehicleListItem)}
      groups={visibleGroups.map((g) => ({
        id: g.id,
        name: g.name,
        vehicleIds: g.vehicles.map((m) => m.vehicleId),
      }))}
      selectedVehicleIds={selectedVehicleIds}
      selections={selectionData}
      initialVisibleFields={user.visibleVehicleFields}
    />
  );
}
