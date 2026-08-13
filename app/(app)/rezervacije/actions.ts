"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";

const reservationSchema = z.object({
  vehicleId: z.string().min(1, "Izberi vozilo."),
  driverId: z.string().optional(),
  routeName: z.string().trim().min(1, "Vnesi ime poti."),
  startAt: z.string().min(1, "Vnesi začetek rezervacije."),
  endAt: z.string().min(1, "Vnesi konec rezervacije."),
});

export type ReservationState = { error?: string; success?: boolean } | undefined;

export async function createReservation(_prevState: ReservationState, formData: FormData): Promise<ReservationState> {
  const user = await requireUser();
  if (!user.canManageVehicles && !user.canManagePlatform) {
    return { error: "Nimaš dovoljenja za rezervacijo vozil." };
  }

  const parsed = reservationSchema.safeParse({
    vehicleId: formData.get("vehicleId"),
    driverId: formData.get("driverId") || undefined,
    routeName: formData.get("routeName"),
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neveljavni podatki." };
  }

  const startAt = new Date(parsed.data.startAt);
  const endAt = new Date(parsed.data.endAt);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return { error: "Neveljaven datum/čas." };
  }
  if (endAt <= startAt) {
    return { error: "Konec rezervacije mora biti po začetku." };
  }

  const vehicle = await prisma.vehicle.findUnique({ where: { id: parsed.data.vehicleId } });
  if (!vehicle) return { error: "Vozilo ne obstaja." };
  if (!user.canManagePlatform && vehicle.tenantId !== user.tenantId) {
    return { error: "Ni dovoljeno." };
  }

  if (parsed.data.driverId) {
    const driver = await prisma.driver.findUnique({ where: { id: parsed.data.driverId } });
    if (!driver || driver.tenantId !== vehicle.tenantId) {
      return { error: "Izbrani voznik ni na voljo za to podjetje." };
    }
  }

  const overlap = await prisma.vehicleReservation.findFirst({
    where: { vehicleId: parsed.data.vehicleId, startAt: { lt: endAt }, endAt: { gt: startAt } },
  });
  if (overlap) {
    return { error: `Vozilo ${vehicle.plate} je v tem času že rezervirano (${overlap.routeName}).` };
  }

  const reservation = await prisma.vehicleReservation.create({
    data: {
      tenantId: vehicle.tenantId,
      vehicleId: vehicle.id,
      driverId: parsed.data.driverId || null,
      routeName: parsed.data.routeName,
      startAt,
      endAt,
      createdByName: user.fullName,
    },
  });

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    tenantId: vehicle.tenantId,
    action: "CREATE",
    entityType: "VehicleReservation",
    entityId: reservation.id,
    entityLabel: `${vehicle.plate} — ${parsed.data.routeName}`,
  });

  revalidatePath("/rezervacije");
  return { success: true };
}

export async function deleteReservation(reservationId: string): Promise<{ error?: string } | undefined> {
  const user = await requireUser();

  const existing = await prisma.vehicleReservation.findUnique({
    where: { id: reservationId },
    include: { vehicle: { select: { plate: true } } },
  });
  if (!existing) return { error: "Rezervacija ne obstaja." };
  if (!user.canManagePlatform && existing.tenantId !== user.tenantId) {
    return { error: "Ni dovoljeno." };
  }

  await prisma.vehicleReservation.delete({ where: { id: reservationId } });

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    tenantId: existing.tenantId,
    action: "DELETE",
    entityType: "VehicleReservation",
    entityId: existing.id,
    entityLabel: `${existing.vehicle.plate} — ${existing.routeName}`,
  });

  revalidatePath("/rezervacije");
}
