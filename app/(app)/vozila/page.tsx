import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AddVehicleForm } from "./add-vehicle-form";

const ICON_LABELS: Record<string, string> = {
  CAR: "Osebno vozilo",
  VAN: "Kombi",
  TRUCK: "Kamion",
  EXCAVATOR: "Bager",
  TRACTOR: "Traktor",
  MOTORCYCLE: "Motor",
};

async function loadTenantData(tenantId: string) {
  return Promise.all([
    prisma.vehicle.findMany({
      where: { tenantId },
      orderBy: { plate: "asc" },
      include: { currentDriver: true, groupMemberships: { include: { group: true } } },
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
          <button type="submit" className="rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-white">
            Prikaži
          </button>
        </form>
      )}

      {!tenantId && isPlatformAdmin && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Izberi podjetje za prikaz in dodajanje vozil.</p>
      )}

      {tenantId && (
        <>
          <section className="space-y-4">
            {isPlatformAdmin && (
              <AddVehicleForm
                availableDevices={availableDevices}
                groups={groups.map((g) => ({ id: g.id, name: g.name }))}
                tenantId={tenantId}
              />
            )}

            <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Registrska</th>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Znamka/model</th>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Letnik</th>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Ikona</th>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Rezervoar (L)</th>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Skupina</th>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Voznik</th>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Komentar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {vehicles.map((v) => (
                    <tr key={v.id}>
                      <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">{v.plate}</td>
                      <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                        {[v.brand, v.model].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{v.year ?? "—"}</td>
                      <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{ICON_LABELS[v.icon]}</td>
                      <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{v.fuelTankVolumeL ?? "—"}</td>
                      <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                        {v.groupMemberships.map((m) => m.group.name).join(", ") || "—"}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{v.currentDriver?.fullName ?? "—"}</td>
                      <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{v.note ?? "—"}</td>
                    </tr>
                  ))}
                  {vehicles.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        Ni še vozil.
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
