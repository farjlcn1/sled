import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { vehicleWhereForUser } from "@/lib/vehicle-access";
import { VozilaListClient, type VozilaListItem } from "./vozila-list-client";

export default async function VozilaPage() {
  const user = await requireUser();

  if (!user.canManageVehicles && !user.canManagePlatform) {
    return <p className="p-3 text-sm text-gray-600 dark:text-gray-400">Nimaš dovoljenja za urejanje vozil.</p>;
  }

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

  const archivedVehicleIds = new Set(archiveGroups.flatMap((g) => g.vehicles.map((m) => m.vehicleId)));
  const activeVehicles = vehicles.filter((v) => !archivedVehicleIds.has(v.id));

  const items: VozilaListItem[] = activeVehicles.map((v) => ({
    id: v.id,
    plate: v.plate,
    brandModel: [v.brand, v.model].filter(Boolean).join(" ") || "—",
    icon: v.icon,
    driverName: v.currentDriver?.fullName ?? null,
  }));

  return <VozilaListClient vehicles={items} />;
}
