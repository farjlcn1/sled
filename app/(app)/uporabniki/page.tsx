import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AddUserForm } from "./add-user-form";
import { ToggleActiveButton } from "./toggle-active-button";
import { EditUserDialog } from "./edit-user-dialog";

const LEVEL_LABELS: Record<string, string> = {
  SUDO: "Sudo",
  UP: "UP — upravitelj podjetja",
  U: "Uporabnik",
  DEMO: "Demo",
};

export default async function UporabnikiPage({
  searchParams,
}: {
  searchParams: Promise<{ podjetje?: string }>;
}) {
  const admin = await requireUser();
  if (!admin.canManageUsers) {
    return <p className="text-sm text-gray-600 dark:text-gray-400">Nimaš dovoljenja za upravljanje uporabnikov.</p>;
  }

  const isSudo = admin.canManagePlatform && !admin.tenantId;
  let tenantId = admin.tenantId ?? undefined;
  let tenants: { id: string; name: string }[] = [];

  if (isSudo) {
    tenants = await prisma.tenant.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    const { podjetje } = await searchParams;
    tenantId = podjetje || undefined;
  }

  const userInclude = {
    vehicleAccess: { select: { vehicleId: true } },
    vehicleGroupAccess: { select: { groupId: true } },
  } as const;

  const [users, vehicles, groups] = tenantId
    ? await Promise.all([
        prisma.user.findMany({ where: { tenantId }, orderBy: { email: "asc" }, include: userInclude }),
        prisma.vehicle.findMany({ where: { tenantId }, orderBy: { plate: "asc" }, select: { id: true, plate: true } }),
        prisma.vehicleGroup.findMany({ where: { tenantId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      ])
    : isSudo
      ? await Promise.all([
          prisma.user.findMany({ where: { tenantId: null }, orderBy: { email: "asc" }, include: userInclude }),
          Promise.resolve([] as { id: string; plate: string }[]),
          Promise.resolve([] as { id: string; name: string }[]),
        ])
      : [[], [], []];

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        {isSudo && (
          <form className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Podjetje</label>
              <select
                name="podjetje"
                defaultValue={tenantId ?? ""}
                className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">— sudo uporabniki (brez podjetja) —</option>
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

        <AddUserForm isSudo={isSudo} tenantId={tenantId} vehicles={vehicles} groups={groups} />

        <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Email</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Ime</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Nivo</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{u.email}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{u.fullName}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{LEVEL_LABELS[u.level]}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{u.isActive ? "Aktiven" : "Onemogočen"}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <EditUserDialog
                        targetUser={{
                          id: u.id,
                          email: u.email,
                          level: u.level,
                          vehicleIds: u.vehicleAccess.map((a) => a.vehicleId),
                          groupIds: u.vehicleGroupAccess.map((a) => a.groupId),
                        }}
                        vehicles={vehicles}
                        groups={groups}
                        isSudo={isSudo}
                      />
                      <ToggleActiveButton userId={u.id} isActive={u.isActive} />
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    Ni še uporabnikov.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
