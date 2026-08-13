import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ReservationCalendar } from "./calendar";

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0=Ned..6=Sob
  const diff = (day === 0 ? -6 : 1) - day; // premakni nazaj na ponedeljek
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default async function RezervacijePage({
  searchParams,
}: {
  searchParams: Promise<{ teden?: string; podjetje?: string }>;
}) {
  const user = await requireUser();
  if (!user.canManageVehicles && !user.canManagePlatform) {
    return <p className="text-sm text-gray-600 dark:text-gray-400">Nimaš dovoljenja za rezervacije vozil.</p>;
  }

  const isPlatformAdmin = user.canManagePlatform && !user.tenantId;
  const { teden, podjetje } = await searchParams;

  let tenantId = user.tenantId ?? undefined;
  let tenants: { id: string; name: string }[] = [];
  if (isPlatformAdmin) {
    tenants = await prisma.tenant.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    tenantId = podjetje || tenants[0]?.id || undefined;
  }

  const parsedWeekDate = teden ? new Date(teden) : new Date();
  const weekStart = startOfWeek(Number.isNaN(parsedWeekDate.getTime()) ? new Date() : parsedWeekDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [vehicles, drivers, reservations] = tenantId
    ? await Promise.all([
        prisma.vehicle.findMany({ where: { tenantId }, orderBy: { plate: "asc" }, select: { id: true, plate: true } }),
        prisma.driver.findMany({ where: { tenantId }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
        prisma.vehicleReservation.findMany({
          where: { tenantId, startAt: { lt: weekEnd }, endAt: { gt: weekStart } },
          orderBy: { startAt: "asc" },
          include: { vehicle: { select: { plate: true } }, driver: { select: { fullName: true } } },
        }),
      ])
    : [[], [], []];

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Rezervacija vozila</h1>

      {isPlatformAdmin && (
        <form className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Podjetje</label>
            <select
              name="podjetje"
              defaultValue={tenantId ?? ""}
              className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <input type="hidden" name="teden" value={teden ?? ""} />
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            Prikaži
          </button>
        </form>
      )}

      {tenantId ? (
        <ReservationCalendar
          weekStartIso={weekStart.toISOString()}
          vehicles={vehicles}
          drivers={drivers}
          reservations={reservations.map((r) => ({
            id: r.id,
            vehicleId: r.vehicleId,
            vehiclePlate: r.vehicle.plate,
            driverName: r.driver?.fullName ?? null,
            routeName: r.routeName,
            startAt: r.startAt.toISOString(),
            endAt: r.endAt.toISOString(),
          }))}
          canDelete={user.canManagePlatform || user.canManageVehicles}
        />
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">Izberi podjetje za prikaz rezervacij.</p>
      )}
    </div>
  );
}
