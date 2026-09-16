import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { vehicleWhereForUser } from "@/lib/vehicle-access";
import { DomovClient, type MobileVehicle } from "./domov-client";

export default async function MobilnaPage() {
  const user = await requireUser();

  const [vehicles, archiveGroups] = await Promise.all([
    prisma.vehicle.findMany({
      where: vehicleWhereForUser(user),
      orderBy: { plate: "asc" },
      include: { currentDriver: { select: { fullName: true } } },
    }),
    prisma.vehicleGroup.findMany({
      where: { isArchiveGroup: true, ...(user.tenantId ? { tenantId: user.tenantId } : {}) },
      select: { vehicles: { select: { vehicleId: true } } },
    }),
  ]);

  // findMany (ne find) -- SUDO uporabnik (tenantId === null) vidi vsa podjetja, zato mora
  // izključiti arhivirana vozila VSEH podjetij, ne le enega naključno najdenega.
  const archivedVehicleIds = new Set(archiveGroups.flatMap((g) => g.vehicles.map((m) => m.vehicleId)));
  const activeVehicles = vehicles.filter((v) => !archivedVehicleIds.has(v.id));

  const mobileVehicles: MobileVehicle[] = activeVehicles.map((v) => ({
    id: v.id,
    plate: v.plate,
    brandModel: [v.brand, v.model].filter(Boolean).join(" ") || "—",
    icon: v.icon,
    driverName: v.currentDriver?.fullName ?? null,
    isPrivateMode: v.isPrivateMode,
  }));

  return <DomovClient vehicles={mobileVehicles} />;
}
