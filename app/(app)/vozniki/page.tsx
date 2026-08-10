import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AddDriverForm } from "./add-driver-form";
import { ImportDriversForm } from "./import-drivers-form";
import { AssignVehicleSelect } from "./assign-vehicle-select";

const ID_METHOD_LABELS: Record<string, string> = {
  IBUTTON: "iButton",
  RFID: "RFID",
  MANUAL: "Ročno",
};

export default async function VozNikiPage() {
  const user = await requireUser();
  const isPlatformAdmin = user.canManagePlatform;

  const [drivers, vehicles] = await Promise.all([
    prisma.driver.findMany({
      where: isPlatformAdmin ? {} : { tenantId: user.tenantId ?? "" },
      orderBy: { fullName: "asc" },
      include: { currentVehicles: { select: { id: true, plate: true }, take: 1 }, tenant: true },
    }),
    user.tenantId
      ? prisma.vehicle.findMany({ where: { tenantId: user.tenantId }, orderBy: { plate: "asc" }, select: { id: true, plate: true } })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      {user.canManageDrivers && user.tenantId && <AddDriverForm />}
      {isPlatformAdmin && <ImportDriversForm />}

      <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Ime</th>
              {isPlatformAdmin && (
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Podjetje</th>
              )}
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Telefon</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Vozniško dovoljenje</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">ID način</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">ID koda</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Trenutno vozilo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {drivers.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{d.fullName}</td>
                {isPlatformAdmin && (
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{d.tenant.name}</td>
                )}
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{d.phone ?? "—"}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{d.licenseNumber ?? "—"}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{ID_METHOD_LABELS[d.idMethod]}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                  <code className="text-xs">{d.idCode ?? "—"}</code>
                </td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                  {user.canManageDrivers && user.tenantId ? (
                    <AssignVehicleSelect driverId={d.id} currentVehicleId={d.currentVehicles[0]?.id ?? null} vehicles={vehicles} />
                  ) : (
                    (d.currentVehicles[0]?.plate ?? "—")
                  )}
                </td>
              </tr>
            ))}
            {drivers.length === 0 && (
              <tr>
                <td colSpan={isPlatformAdmin ? 7 : 6} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  Ni še voznikov.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
