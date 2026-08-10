import { requirePlatformAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AddPlanForm } from "./add-plan-form";
import { TogglePlanButton } from "./toggle-plan-button";

export default async function PaketiPage() {
  await requirePlatformAdmin();

  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: { priceMonthlyCents: "asc" },
    include: { _count: { select: { subscriptions: { where: { status: "ACTIVE" } } } } },
  });

  return (
    <div className="space-y-6">
      <AddPlanForm />

      <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Ime</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Cena</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Meja naprav</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Opis</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Aktivnih podjetij</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {plans.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{p.name}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                  {(p.priceMonthlyCents / 100).toFixed(2)} €/mesec
                </td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{p.deviceLimit}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{p.description ?? "—"}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{p._count.subscriptions}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{p.isActive ? "Aktiven" : "Onemogočen"}</td>
                <td className="px-4 py-2 text-right">
                  <TogglePlanButton id={p.id} isActive={p.isActive} />
                </td>
              </tr>
            ))}
            {plans.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  Ni še paketov.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
