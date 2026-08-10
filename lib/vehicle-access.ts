import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/auth/session";

// Kdo vidi katera vozila:
// - administracija (canManagePlatform): vse, ne glede na podjetje
// - upravljalec voznega parka (canManageVehicles): vsa vozila svojega podjetja
// - omejen uporabnik: samo vozila, ki so mu dodeljena posamično ali prek skupine
export function vehicleWhereForUser(user: CurrentUser): Prisma.VehicleWhereInput {
  if (user.canManagePlatform) return {};
  if (!user.tenantId) return { id: "__brez-dostopa__" };
  if (user.canManageVehicles) return { tenantId: user.tenantId };

  return {
    tenantId: user.tenantId,
    OR: [
      { userAccess: { some: { userId: user.id } } },
      { groupMemberships: { some: { group: { memberships: { some: { userId: user.id } } } } } },
    ],
  };
}
