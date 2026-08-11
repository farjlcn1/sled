import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { vehicleWhereForUser } from "@/lib/vehicle-access";
import { NalogForm } from "./nalog-form";
import { CompleteDialog } from "./complete-dialog";
import { LikvidirajButton } from "./likvidiraj-button";

const STATUS_LABELS: Record<string, string> = {
  ODREJEN: "Odrejen",
  V_TEKU: "V teku",
  ZAKLJUCEN: "Zaključen",
  LIKVIDIRAN: "Likvidiran",
};

function fmtDateTime(d: Date) {
  return d.toLocaleString("sl-SI", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

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

          <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Št.</th>
                  <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Vozilo</th>
                  <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Voznik</th>
                  <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Namen</th>
                  <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Planiran odhod</th>
                  <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Planirana vrnitev</th>
                  <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {nalogi.map((n) => (
                  <tr key={n.id}>
                    <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">{n.number}</td>
                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{n.vehicle.plate}</td>
                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{n.driver?.fullName ?? "—"}</td>
                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{n.purpose}</td>
                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{fmtDateTime(n.plannedDepartureAt)}</td>
                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{fmtDateTime(n.plannedReturnAt)}</td>
                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{STATUS_LABELS[n.status]}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/potni-nalogi/${n.id}/print`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 dark:border-gray-600 dark:text-gray-300"
                        >
                          Natisni
                        </a>
                        {(n.status === "ODREJEN" || n.status === "V_TEKU") && (
                          <CompleteDialog
                            nalogId={n.id}
                            plannedDepartureAt={n.plannedDepartureAt.toISOString()}
                            plannedReturnAt={n.plannedReturnAt.toISOString()}
                          />
                        )}
                        {n.status === "ZAKLJUCEN" && <LikvidirajButton nalogId={n.id} />}
                      </div>
                    </td>
                  </tr>
                ))}
                {nalogi.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      Ni še potnih nalogov.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
