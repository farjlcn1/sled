import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AddDriverForm } from "./add-driver-form";
import { ImportDriversForm } from "./import-drivers-form";
import { DriversTable, type DriverRow } from "./drivers-table";

export default async function VozNikiPage() {
  const user = await requireUser();
  const isPlatformAdmin = user.canManagePlatform;

  const [drivers, vehicles, tenants] = await Promise.all([
    prisma.driver.findMany({
      where: isPlatformAdmin ? {} : { tenantId: user.tenantId ?? "" },
      orderBy: { fullName: "asc" },
      include: { currentVehicles: { select: { id: true, plate: true }, take: 1 }, tenant: true },
    }),
    user.tenantId
      ? prisma.vehicle.findMany({ where: { tenantId: user.tenantId }, orderBy: { plate: "asc" }, select: { id: true, plate: true } })
      : Promise.resolve([]),
    !user.tenantId
      ? prisma.tenant.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);

  const driverRows: DriverRow[] = drivers.map((d) => ({
    id: d.id,
    fullName: d.fullName,
    tenantName: d.tenant.name,
    phone: d.phone,
    licenseNumber: d.licenseNumber,
    idMethod: d.idMethod,
    idCode: d.idCode,
    currentVehicleId: d.currentVehicles[0]?.id ?? null,
    currentVehiclePlate: d.currentVehicles[0]?.plate ?? null,
  }));

  const canAssignVehicle = user.canManageDrivers && Boolean(user.tenantId);
  const canEdit = canAssignVehicle || isPlatformAdmin;
  const canAddDriver = (user.canManageDrivers && Boolean(user.tenantId)) || isPlatformAdmin;

  return (
    <div className="space-y-6">
      {canAddDriver && <AddDriverForm tenants={!user.tenantId ? tenants : undefined} />}
      {isPlatformAdmin && <ImportDriversForm />}

      <DriversTable
        drivers={driverRows}
        vehicles={vehicles}
        showTenantColumn={isPlatformAdmin}
        canAssignVehicle={canAssignVehicle}
        canEdit={canEdit}
        canBulkDelete={isPlatformAdmin}
      />
    </div>
  );
}
