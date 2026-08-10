import { requirePlatformAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AddTenantForm } from "./add-tenant-form";
import { AssignPlanSelect } from "./assign-plan-select";

export default async function NajemnikiPage() {
  await requirePlatformAdmin();

  const [tenants, plans] = await Promise.all([
    prisma.tenant.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { vehicles: true, devices: true, users: true } },
        subscription: { include: { plan: true } },
      },
    }),
    prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { priceMonthlyCents: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-6">
      <AddTenantForm />

      <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Ime</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Paket</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Meja naprav</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Vozila</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Naprave</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Uporabniki</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {tenants.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{t.name}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                  <AssignPlanSelect
                    tenantId={t.id}
                    currentPlanId={t.subscription?.status === "ACTIVE" ? t.subscription.planId : null}
                    plans={plans}
                  />
                </td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{t.deviceLimit}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{t._count.vehicles}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{t._count.devices}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{t._count.users}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                  {t.isActive ? "Aktivna" : "Neaktivna"}
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  Ni še podjetij.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
