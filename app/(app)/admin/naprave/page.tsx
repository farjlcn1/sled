import { requirePlatformAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AddDeviceForm } from "./add-device-form";
import { ImportDevicesForm } from "./import-devices-form";
import { DeleteDeviceButton } from "./delete-device-button";
import { AssignTenantSelect } from "./assign-tenant-select";

export default async function NapravePage() {
  await requirePlatformAdmin();

  const [devices, tenants] = await Promise.all([
    prisma.device.findMany({
      orderBy: { createdAt: "desc" },
      include: { tenant: true, vehicle: true },
    }),
    prisma.tenant.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-6">
      <AddDeviceForm />
      <ImportDevicesForm />

      <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">IMEI</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Znamka/model</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Serijska št.</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">SIM</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Protokol</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Podjetje</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Vozilo</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Opomba</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {devices.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{d.imei}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                  {[d.brand, d.model].filter(Boolean).join(" ") || "—"}
                </td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{d.serialNumber ?? "—"}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{d.simNumber ?? "—"}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{d.protocol}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                  <AssignTenantSelect deviceId={d.id} currentTenantId={d.tenantId} tenants={tenants} />
                </td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                  {d.vehicle ? d.vehicle.plate : <span className="text-gray-400">nedodeljeno</span>}
                </td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{d.note ?? ""}</td>
                <td className="px-4 py-2 text-right">
                  <DeleteDeviceButton id={d.id} />
                </td>
              </tr>
            ))}
            {devices.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  Ni še naprav.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
