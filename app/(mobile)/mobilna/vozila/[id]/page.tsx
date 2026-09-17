import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { EditVehicleClient } from "./edit-vehicle-client";

export default async function VoziloEditPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  if (!user.canManageVehicles && !user.canManagePlatform) {
    return <p className="p-3 text-sm text-gray-600 dark:text-gray-400">Nimaš dovoljenja za urejanje vozil.</p>;
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: { groupMemberships: { select: { groupId: true } } },
  });
  if (!vehicle) notFound();
  if (!user.canManagePlatform && vehicle.tenantId !== user.tenantId) notFound();

  const groups = await prisma.vehicleGroup.findMany({
    where: { tenantId: vehicle.tenantId, isArchiveGroup: false },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <EditVehicleClient
      vehicleId={vehicle.id}
      plate={vehicle.plate}
      brandModel={[vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "—"}
      icon={vehicle.icon}
      groups={groups}
      memberGroupIds={vehicle.groupMemberships.map((m) => m.groupId)}
    />
  );
}
