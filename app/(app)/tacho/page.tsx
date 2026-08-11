import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { vehicleWhereForUser } from "@/lib/vehicle-access";
import { ScheduleToggle } from "./schedule-toggle";
import { SelectAllToggle } from "./select-all-toggle";
import { PeriodInput } from "./period-input";
import { UploadForm } from "./upload-form";
import { DeleteFileButton } from "./delete-file-button";
import { toggleVehicleSchedule, setAllVehicleSchedules, toggleDriverSchedule, setAllDriverSchedules } from "./actions";

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString("sl-SI", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

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
            vehicle: { select: { plate: true } },
            driver: { select: { fullName: true } },
          },
        }),
      ])
    : [[], [], []];

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
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Vozila — urnik prenosa (VU)</h2>
              <SelectAllToggle tenantId={tenantId} action={setAllVehicleSchedules} label="Izberi vsa vozila" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Urnik služi kot opomnik, kdaj je treba prenesti podatke iz enote v vozilu (EU: največ 90 dni med prenosi) — ne sproži
              samodejnega prenosa.
            </p>
            <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">V urniku</th>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Vozilo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {vehicles.map((v) => (
                    <tr key={v.id}>
                      <td className="px-3 py-2">
                        <ScheduleToggle id={v.id} checked={v.tachoScheduleEnabled} action={toggleVehicleSchedule} />
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{v.plate}</td>
                    </tr>
                  ))}
                  {vehicles.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        Ni vozil.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Vozniki — urnik prenosa (kartica)</h2>
              <SelectAllToggle tenantId={tenantId} action={setAllDriverSchedules} label="Izberi vse voznike" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              EU: kartico voznika je treba prenesti najkasneje vsakih 28 dni. Obdobje spodaj je opomnik, ne samodejen prenos.
            </p>
            <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">V urniku</th>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Voznik</th>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Obdobje prenosa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {drivers.map((d) => (
                    <tr key={d.id}>
                      <td className="px-3 py-2">
                        <ScheduleToggle id={d.id} checked={d.tachoScheduleEnabled} action={toggleDriverSchedule} />
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{d.fullName}</td>
                      <td className="px-3 py-2">
                        <PeriodInput driverId={d.id} days={d.tachoDownloadPeriodDays} />
                      </td>
                    </tr>
                  ))}
                  {drivers.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        Ni voznikov.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Naloži DDD datoteko</h2>
            <UploadForm vehicles={vehicles} drivers={drivers} />
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Naložene datoteke ({files.length})</h2>
            <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Tip</th>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Vozilo/voznik</th>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Ime datoteke</th>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Obdobje</th>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Velikost</th>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Naloženo</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {files.map((f) => (
                    <tr key={f.id}>
                      <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{f.kind === "VOZILO" ? "Vozilo" : "Voznik"}</td>
                      <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{f.vehicle?.plate ?? f.driver?.fullName ?? "—"}</td>
                      <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{f.fileName}</td>
                      <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                        {fmtDate(f.periodFrom)} – {fmtDate(f.periodTo)}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{fmtSize(f.fileSize)}</td>
                      <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{fmtDate(f.downloadedAt)}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={`/tacho/pregled/${f.id}`}
                            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 dark:border-gray-600 dark:text-gray-300"
                          >
                            Poglej
                          </a>
                          <DeleteFileButton id={f.id} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {files.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        Ni še naloženih datotek.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
