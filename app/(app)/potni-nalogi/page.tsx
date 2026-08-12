import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { vehicleWhereForUser } from "@/lib/vehicle-access";
import { NalogForm } from "./nalog-form";
import { NalogiTable, type PotniNalogRow } from "./nalogi-table";

export default async function PotniNalogiPage({
  searchParams,
}: {
  searchParams: Promise<{ podjetje?: string }>;
}) {
  const user = await requireUser();
  if (!user.canManageUsers) {
    return <p className="text-sm text-gray-600 dark:text-gray-400">Nimaš dovoljenja za upravljanje potnih nalogov.</p>;
  }

  const isSudo = user.canManagePlatform && !user.tenantId;
  let tenantId = user.tenantId ?? undefined;
  let tenants: { id: string; name: string }[] = [];

  if (isSudo) {
    tenants = await prisma.tenant.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
    const { podjetje } = await searchParams;
    tenantId = podjetje || undefined;
  }

  const [vehicles, drivers, nalogi] = tenantId
    ? await Promise.all([
        prisma.vehicle.findMany({
          where: { ...vehicleWhereForUser(user), tenantId },
          orderBy: { plate: "asc" },
          select: { id: true, plate: true, device: { select: { traccarDeviceId: true } } },
        }),
        prisma.driver.findMany({ where: { tenantId }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
        prisma.potniNalog.findMany({
          where: { tenantId },
          orderBy: { issuedAt: "desc" },
          include: { vehicle: { select: { plate: true } }, driver: { select: { fullName: true } } },
        }),
      ])
    : [[], [], []];

  const nalogRows: PotniNalogRow[] = nalogi.map((n) => ({
    id: n.id,
    number: n.number,
    vehiclePlate: n.vehicle.plate,
    driverName: n.driver?.fullName ?? null,
    purpose: n.purpose,
    plannedDepartureAt: n.plannedDepartureAt.toISOString(),
    plannedReturnAt: n.plannedReturnAt.toISOString(),
    status: n.status,
  }));

  return (
    <div className="space-y-6">
      {isSudo && (
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

      {!tenantId && isSudo && <p className="text-sm text-gray-500 dark:text-gray-400">Izberi podjetje za prikaz potnih nalogov.</p>}

      {tenantId && (
        <>
          <NalogForm vehicles={vehicles} drivers={drivers} />

          <NalogiTable rows={nalogRows} />
        </>
      )}
    </div>
  );
}
