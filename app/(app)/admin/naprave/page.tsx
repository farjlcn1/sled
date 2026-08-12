import { requirePlatformAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AddDeviceForm } from "./add-device-form";
import { ImportDevicesForm } from "./import-devices-form";
import { DevicesTable, type DeviceRow } from "./devices-table";

export default async function NapravePage() {
  await requirePlatformAdmin();

  const [devices, tenants] = await Promise.all([
    prisma.device.findMany({
      orderBy: { createdAt: "desc" },
      include: { tenant: true, vehicle: true },
    }),
    prisma.tenant.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const deviceRows: DeviceRow[] = devices.map((d) => ({
    id: d.id,
    imei: d.imei,
    brand: d.brand,
    model: d.model,
    serialNumber: d.serialNumber,
    simNumber: d.simNumber,
    protocol: d.protocol,
    note: d.note,
    tenantId: d.tenantId,
    tenantName: d.tenant?.name ?? null,
    vehiclePlate: d.vehicle?.plate ?? null,
  }));

  return (
    <div className="space-y-6">
      <AddDeviceForm />
      <ImportDevicesForm />
      <DevicesTable devices={deviceRows} tenants={tenants} />
    </div>
  );
}
