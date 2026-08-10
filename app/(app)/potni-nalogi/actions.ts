"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { vehicleWhereForUser } from "@/lib/vehicle-access";
import { nextPotniNalogNumber, suggestActualFromGps, type GpsSuggestion } from "@/lib/potni-nalog";

async function requireManager() {
  const user = await requireUser();
  if (!user.canManageUsers) {
    throw new Error("Nimaš dovoljenja za upravljanje potnih nalogov.");
  }
  return user;
}

async function assertOwnVehicle(vehicleId: string, user: Awaited<ReturnType<typeof requireUser>>) {
  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, ...vehicleWhereForUser(user) } });
  if (!vehicle) throw new Error("Vozilo ni na voljo.");
  return vehicle;
}

const createSchema = z.object({
  vehicleId: z.string().min(1, "Izberi vozilo."),
  driverId: z.string().optional(),
  issuedByName: z.string().trim().min(1, "Vnesi odredbodajalca."),
  purpose: z.string().trim().min(1, "Vnesi namen poti."),
  plannedFrom: z.string().trim().min(1, "Vnesi kraj odhoda."),
  plannedTo: z.string().trim().min(1, "Vnesi cilj."),
  plannedVia: z.string().optional(),
  plannedDepartureAt: z.string().min(1, "Vnesi planiran odhod."),
  plannedReturnAt: z.string().min(1, "Vnesi planirano vrnitev."),
});

export type PotniNalogState = { error?: string; success?: boolean } | undefined;

export async function createPotniNalog(_prevState: PotniNalogState, formData: FormData): Promise<PotniNalogState> {
  const user = await requireManager();

  const parsed = createSchema.safeParse({
    vehicleId: formData.get("vehicleId"),
    driverId: formData.get("driverId") || undefined,
    issuedByName: formData.get("issuedByName"),
    purpose: formData.get("purpose"),
    plannedFrom: formData.get("plannedFrom"),
    plannedTo: formData.get("plannedTo"),
    plannedVia: formData.get("plannedVia") || undefined,
    plannedDepartureAt: formData.get("plannedDepartureAt"),
    plannedReturnAt: formData.get("plannedReturnAt"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neveljavni podatki." };
  }

  const vehicle = await assertOwnVehicle(parsed.data.vehicleId, user);
  const departureAt = new Date(parsed.data.plannedDepartureAt);
  const returnAt = new Date(parsed.data.plannedReturnAt);
  if (returnAt <= departureAt) {
    return { error: "Planirana vrnitev mora biti po planiranem odhodu." };
  }

  const number = await nextPotniNalogNumber(vehicle.tenantId, departureAt.getFullYear());

  await prisma.potniNalog.create({
    data: {
      tenantId: vehicle.tenantId,
      number,
      vehicleId: vehicle.id,
      driverId: parsed.data.driverId || null,
      issuedByName: parsed.data.issuedByName,
      purpose: parsed.data.purpose,
      plannedFrom: parsed.data.plannedFrom,
      plannedTo: parsed.data.plannedTo,
      plannedVia: parsed.data.plannedVia || null,
      plannedDepartureAt: departureAt,
      plannedReturnAt: returnAt,
    },
  });

  revalidatePath("/potni-nalogi");
  return { success: true };
}

const completeSchema = z.object({
  id: z.string(),
  actualDepartureAt: z.string().min(1, "Vnesi dejanski odhod."),
  actualReturnAt: z.string().min(1, "Vnesi dejansko vrnitev."),
  startOdometerKm: z.coerce.number().optional(),
  endOdometerKm: z.coerce.number().optional(),
  actualDistanceKm: z.coerce.number().optional(),
  dailyAllowanceEur: z.coerce.number().optional(),
  otherCostsEur: z.coerce.number().optional(),
  otherCostsNote: z.string().optional(),
  note: z.string().optional(),
});

export async function completePotniNalog(_prevState: PotniNalogState, formData: FormData): Promise<PotniNalogState> {
  const user = await requireManager();

  const parsed = completeSchema.safeParse({
    id: formData.get("id"),
    actualDepartureAt: formData.get("actualDepartureAt"),
    actualReturnAt: formData.get("actualReturnAt"),
    startOdometerKm: formData.get("startOdometerKm") || undefined,
    endOdometerKm: formData.get("endOdometerKm") || undefined,
    actualDistanceKm: formData.get("actualDistanceKm") || undefined,
    dailyAllowanceEur: formData.get("dailyAllowanceEur") || undefined,
    otherCostsEur: formData.get("otherCostsEur") || undefined,
    otherCostsNote: formData.get("otherCostsNote") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neveljavni podatki." };
  }

  const nalog = await prisma.potniNalog.findUnique({ where: { id: parsed.data.id } });
  if (!nalog) return { error: "Potni nalog ne obstaja." };
  if (!user.canManagePlatform && nalog.tenantId !== user.tenantId) {
    return { error: "Ni dovoljeno." };
  }

  await prisma.potniNalog.update({
    where: { id: nalog.id },
    data: {
      status: "ZAKLJUCEN",
      actualDepartureAt: new Date(parsed.data.actualDepartureAt),
      actualReturnAt: new Date(parsed.data.actualReturnAt),
      startOdometerKm: parsed.data.startOdometerKm ?? null,
      endOdometerKm: parsed.data.endOdometerKm ?? null,
      actualDistanceKm: parsed.data.actualDistanceKm ?? null,
      dailyAllowanceEur: parsed.data.dailyAllowanceEur ?? null,
      otherCostsEur: parsed.data.otherCostsEur ?? null,
      otherCostsNote: parsed.data.otherCostsNote || null,
      note: parsed.data.note || null,
      driverSignedAt: new Date(),
    },
  });

  revalidatePath("/potni-nalogi");
  return { success: true };
}

export async function likvidirajPotniNalog(id: string) {
  const user = await requireManager();
  const nalog = await prisma.potniNalog.findUnique({ where: { id } });
  if (!nalog) throw new Error("Potni nalog ne obstaja.");
  if (!user.canManagePlatform && nalog.tenantId !== user.tenantId) {
    throw new Error("Ni dovoljeno.");
  }
  if (nalog.status !== "ZAKLJUCEN") {
    throw new Error("Likvidirati je mogoče samo zaključen potni nalog.");
  }

  await prisma.potniNalog.update({
    where: { id },
    data: { status: "LIKVIDIRAN", approverSignedAt: new Date() },
  });
  revalidatePath("/potni-nalogi");
}

export async function suggestFromGps(nalogId: string): Promise<GpsSuggestion> {
  const user = await requireManager();
  const nalog = await prisma.potniNalog.findUnique({
    where: { id: nalogId },
    include: { vehicle: { include: { device: true } } },
  });
  if (!nalog) throw new Error("Potni nalog ne obstaja.");
  if (!user.canManagePlatform && nalog.tenantId !== user.tenantId) {
    throw new Error("Ni dovoljeno.");
  }

  // Malo razširjeno okno okoli planiranega odhoda/vrnitve, če je dejanska pot stekla prej/pozneje.
  const from = new Date(nalog.plannedDepartureAt.getTime() - 3 * 60 * 60 * 1000);
  const to = new Date(nalog.plannedReturnAt.getTime() + 3 * 60 * 60 * 1000);
  return suggestActualFromGps(nalog.vehicle, from, to);
}
