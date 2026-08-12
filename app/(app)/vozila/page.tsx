import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AddVehicleForm } from "./add-vehicle-form";
import { VehiclesTable, type VehicleRow } from "./vehicles-table";

async function loadTenantData(tenantId: string) {
  return Promise.all([
    prisma.vehicle.findMany({
      where: { tenantId },
      orderBy: { plate: "asc" },
      include: { currentDriver: true, groupMemberships: { include: { group: true } }, device: true },
    }),
    prisma.device.findMany({ where: { tenantId, vehicle: null }, select: { id: true, imei: true } }),
    prisma.vehicleGroup.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      include: { vehicles: { select: { vehicleId: true } } },
    }),
  ]);
}

export default async function VozilaPage({
  searchParams,
}: {
  searchParams: Promise<{ podjetje?: string }>;
}) {
  const user = await requireUser();
  if (!user.canManageVehicles && !user.canManagePlatform) {
    return <p className="text-sm text-gray-600 dark:text-gray-400">Nimaš dovoljenja za upravljanje vozil.</p>;
  }

  const isPlatformAdmin = user.canManagePlatform && !user.tenantId;
  let tenantId = user.tenantId ?? undefined;
  let tenants: { id: string; name: string }[] = [];

  if (isPlatformAdmin) {
    tenants = await prisma.tenant.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    const { podjetje } = await searchParams;
    tenantId = podjetje || undefined;
  }

  const [vehicles, availableDevices, groups] = tenantId ? await loadTenantData(tenantId) : [[], [], []];

  const vehicleRows: VehicleRow[] = vehicles.map((v) => ({
    id: v.id,
    plate: v.plate,
    brand: v.brand,
    model: v.model,
    year: v.year,
    icon: v.icon,
    fuelTankVolumeL: v.fuelTankVolumeL,
    note: v.note,
    deviceId: v.deviceId,
    driverName: v.currentDriver?.fullName ?? null,
    groupNames: v.groupMemberships.map((m) => m.group.name),
  }));

  return (
    <div className="space-y-8">
      {isPlatformAdmin && (
        <form className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Podjetje</label>
            <select
              name="podjetje"
              defaultValue={tenantId ?? ""}
              className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="" disabled>
                — izberi podjetje —
              </option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            Prikaži
          </button>
        </form>
      )}

      {!tenantId && isPlatformAdmin && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Izberi podjetje za prikaz in dodajanje vozil.</p>
      )}

      {tenantId && (
        <section className="space-y-4">
          {isPlatformAdmin && (
            <AddVehicleForm
              availableDevices={availableDevices}
              groups={groups.map((g) => ({ id: g.id, name: g.name }))}
              tenantId={tenantId}
            />
          )}

          <VehiclesTable vehicles={vehicleRows} availableDevices={availableDevices} canBulkDelete={user.canManagePlatform} />
        </section>
      )}
    </div>
  );
}
