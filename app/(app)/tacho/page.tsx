import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { vehicleWhereForUser } from "@/lib/vehicle-access";
import { UploadForm } from "./upload-form";
import { VehicleScheduleTable } from "./vehicle-schedule-table";
import { DriverScheduleTable } from "./driver-schedule-table";
import { TachoFilesTable } from "./tacho-files-table";
import { toggleVehicleSchedule, setAllVehicleSchedules, toggleDriverSchedule, setAllDriverSchedules } from "./actions";

export default async function TachoPage({
  searchParams,
}: {
  searchParams: Promise<{ podjetje?: string }>;
}) {
  const user = await requireUser();
  if (!user.canManageUsers) {
    return <p className="text-sm text-gray-600 dark:text-gray-400">Nimaš dovoljenja za upravljanje tahografskih podatkov.</p>;
  }

  const isSudo = user.canManagePlatform && !user.tenantId;
  let tenantId = user.tenantId ?? undefined;
  let tenants: { id: string; name: string }[] = [];

  if (isSudo) {
    tenants = await prisma.tenant.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
    const { podjetje } = await searchParams;
    tenantId = podjetje || undefined;
  }

  const [vehicles, drivers, files] = tenantId
    ? await Promise.all([
        prisma.vehicle.findMany({
          where: { ...vehicleWhereForUser(user), tenantId },
          orderBy: { plate: "asc" },
          select: { id: true, plate: true, tachoScheduleEnabled: true },
        }),
        prisma.driver.findMany({
          where: { tenantId },
          orderBy: { fullName: "asc" },
          select: { id: true, fullName: true, tachoScheduleEnabled: true, tachoDownloadPeriodDays: true },
        }),
        prisma.tachoFile.findMany({
          where: { tenantId },
          orderBy: { downloadedAt: "desc" },
          select: {
            id: true,
            kind: true,
            fileName: true,
            fileSize: true,
            downloadedAt: true,
            periodFrom: true,
            periodTo: true,
            vehicleId: true,
            driverId: true,
            vehicle: { select: { plate: true } },
            driver: { select: { fullName: true } },
          },
        }),
      ])
    : [[], [], []];

  // "files" je ze razvrscen po downloadedAt desc, zato je prvo ujemanje na vozilo/voznika
  // hkrati zadnje nalozeno -- brez dodatne poizvedbe.
  const lastFileByVehicle = new Map<string, { id: string; downloadedAt: Date }>();
  const lastFileByDriver = new Map<string, { id: string; downloadedAt: Date }>();
  for (const f of files) {
    if (f.vehicleId && !lastFileByVehicle.has(f.vehicleId)) lastFileByVehicle.set(f.vehicleId, f);
    if (f.driverId && !lastFileByDriver.has(f.driverId)) lastFileByDriver.set(f.driverId, f);
  }

  return (
    <div className="space-y-8">
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

      {!tenantId && isSudo && <p className="text-sm text-gray-500 dark:text-gray-400">Izberi podjetje za prikaz.</p>}

      {tenantId && (
        <>
          <section className="space-y-2">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Vozila — urnik prenosa (VU)</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Urnik služi kot opomnik, kdaj je treba prenesti podatke iz enote v vozilu (EU: največ 90 dni med prenosi) — ne sproži
              samodejnega prenosa.
            </p>
            <VehicleScheduleTable
              vehicles={vehicles.map((v) => ({ ...v, lastFile: lastFileByVehicle.get(v.id) ?? null }))}
              action={toggleVehicleSchedule}
              tenantId={tenantId}
              selectAllAction={setAllVehicleSchedules}
            />
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Vozniki — urnik prenosa (kartica)</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              EU: kartico voznika je treba prenesti najkasneje vsakih 28 dni. Obdobje spodaj je opomnik, ne samodejen prenos.
            </p>
            <DriverScheduleTable
              drivers={drivers.map((d) => ({ ...d, lastFile: lastFileByDriver.get(d.id) ?? null }))}
              action={toggleDriverSchedule}
              tenantId={tenantId}
              selectAllAction={setAllDriverSchedules}
            />
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Naloži DDD datoteko</h2>
            <UploadForm vehicles={vehicles} drivers={drivers} />
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Naložene datoteke ({files.length})</h2>
            <TachoFilesTable files={files} />
          </section>
        </>
      )}
    </div>
  );
}
