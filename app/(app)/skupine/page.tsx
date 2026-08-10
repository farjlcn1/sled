import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AddGroupForm } from "../vozila/add-group-form";
import { GroupVehicleToggle } from "../vozila/group-vehicle-toggle";

async function loadTenantData(tenantId: string) {
  return Promise.all([
    prisma.vehicle.findMany({
      where: { tenantId },
      orderBy: { plate: "asc" },
      select: { id: true, plate: true },
    }),
    prisma.vehicleGroup.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      include: { vehicles: { select: { vehicleId: true } } },
    }),
  ]);
}

export default async function SkupinePage({
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

  const [vehicles, groups] = tenantId ? await loadTenantData(tenantId) : [[], []];

  return (
    <div className="space-y-4">
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
        <p className="text-sm text-gray-500 dark:text-gray-400">Izberi podjetje za prikaz skupin.</p>
      )}

      {tenantId && (
        <section className="space-y-4">
          <AddGroupForm tenantId={user.tenantId ? undefined : tenantId} />

          <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Skupina</th>
                  {vehicles.map((v) => (
                    <th
                      key={v.id}
                      className="px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400"
                    >
                      {v.plate}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {groups.map((g) => {
                  const memberIds = new Set(g.vehicles.map((v) => v.vehicleId));
                  return (
                    <tr key={g.id}>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{g.name}</td>
                      {vehicles.map((v) => (
                        <td key={v.id} className="px-2 py-2 text-center">
                          <GroupVehicleToggle groupId={g.id} vehicleId={v.id} inGroup={memberIds.has(v.id)} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {groups.length === 0 && (
                  <tr>
                    <td
                      colSpan={vehicles.length + 1}
                      className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      Ni še skupin vozil.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
