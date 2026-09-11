import "server-only";
import { prisma } from "@/lib/db";
import type { PrivacyRetentionTier } from "@/generated/prisma/client";

// Jedro vklopa/izklopa zasebnega načina, ločeno od avtorizacije -- kliče ga tako
// startPrivateMode/endPrivateMode (vozila/actions.ts, preveri sejo/lastništvo vozila) KOT
// scripts/private-mode-sync.ts (zaupan ozadnji tek prek systemd timerja, brez HTTP/cookie
// konteksta, zato ne more klicati "use server" akcij neposredno -- isto načelo kot
// generateInvoiceForTenant v lib/invoice.ts, ki ga uporabljata tako akcija kot scripts/monthly-billing.ts).
export async function startPrivateModeForVehicle(vehicleId: string, retentionTier: PrivacyRetentionTier): Promise<void> {
  await prisma.$transaction([
    prisma.vehiclePrivacyPeriod.updateMany({ where: { vehicleId, endedAt: null }, data: { endedAt: new Date() } }),
    prisma.vehiclePrivacyPeriod.create({ data: { vehicleId, retentionTier } }),
    prisma.vehicle.update({ where: { id: vehicleId }, data: { isPrivateMode: true } }),
  ]);
}

export async function endPrivateModeForVehicle(vehicleId: string): Promise<void> {
  await prisma.$transaction([
    prisma.vehiclePrivacyPeriod.updateMany({ where: { vehicleId, endedAt: null }, data: { endedAt: new Date() } }),
    prisma.vehicle.update({ where: { id: vehicleId }, data: { isPrivateMode: false } }),
  ]);
}
