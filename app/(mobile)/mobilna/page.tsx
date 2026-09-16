import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { vehicleWhereForUser } from "@/lib/vehicle-access";
import { MobileShell, type MobileVehicle, type MobileGroup } from "./mobile-shell";

export default async function MobilnaPage() {
  const user = await requireUser();

  const [vehicles, groups] = await Promise.all([
    prisma.vehicle.findMany({
      where: vehicleWhereForUser(user),
      orderBy: { plate: "asc" },
      include: { currentDriver: { select: { fullName: true } } },
    }),
    prisma.vehicleGroup.findMany({
      where: user.tenantId ? { tenantId: user.tenantId } : {},
      orderBy: { name: "asc" },
      include: { vehicles: { select: { vehicleId: true } } },
    }),
  ]);

  // Arhivirana vozila namerno izpuščena -- glej isArchiveGroup v zemljevid/page.tsx za isti vzorec;
  // za "hiter pogled" na telefonu arhiv ni relevanten.
  const archiveGroup = groups.find((g) => g.isArchiveGroup) ?? null;
  const archivedVehicleIds = new Set(archiveGroup?.vehicles.map((m) => m.vehicleId) ?? []);
  const activeVehicles = vehicles.filter((v) => !archivedVehicleIds.has(v.id));
  const visibleGroups = groups.filter((g) => !g.isArchiveGroup);

  const mobileVehicles: MobileVehicle[] = activeVehicles.map((v) => ({
    id: v.id,
    plate: v.plate,
    icon: v.icon,
    driverName: v.currentDriver?.fullName ?? null,
    isPrivateMode: v.isPrivateMode,
  }));

  const mobileGroups: MobileGroup[] = visibleGroups.map((g) => ({
    id: g.id,
    name: g.name,
    vehicleIds: g.vehicles.map((m) => m.vehicleId),
  }));

  return <MobileShell vehicles={mobileVehicles} groups={mobileGroups} />;
}
