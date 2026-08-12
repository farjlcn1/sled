"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission, requirePlatformAdmin, requireUser } from "@/lib/auth/session";
import { diffFields, logAudit } from "@/lib/audit";
import { parseXlsxRows, findColumn } from "@/lib/xlsx-import";

const driverSchema = z.object({
  fullName: z.string().trim().min(1, "Vnesi ime voznika."),
  phone: z.string().optional(),
  licenseNumber: z.string().optional(),
  idMethod: z.enum(["IBUTTON", "RFID", "MANUAL"]).default("RFID"),
  idCode: z.string().trim().min(1, "Vnesi ID kodo."),
});

export type DriverState = { error?: string } | undefined;

export async function createDriver(_prevState: DriverState, formData: FormData): Promise<DriverState> {
  const user = await requireUser();
  if (!user.canManageDrivers && !user.canManagePlatform) {
    return { error: "Nimaš dovoljenja za dodajanje voznikov." };
  }

  const tenantId = user.tenantId || String(formData.get("tenantId") ?? "");
  if (!tenantId) return { error: "Izberi podjetje." };

  if (!user.tenantId) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return { error: "Podjetje ne obstaja." };
  }

  const parsed = driverSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone") || undefined,
    licenseNumber: formData.get("licenseNumber") || undefined,
    idMethod: formData.get("idMethod") || "RFID",
    idCode: formData.get("idCode") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neveljavni podatki." };
  }

  let driverId: string;
  try {
    const driver = await prisma.driver.create({
      data: {
        tenantId,
        fullName: parsed.data.fullName,
        phone: parsed.data.phone,
        licenseNumber: parsed.data.licenseNumber,
        idMethod: parsed.data.idMethod,
        idCode: parsed.data.idCode,
      },
    });
    driverId = driver.id;
  } catch {
    return { error: "Voznik s to ID kodo že obstaja." };
  }

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    tenantId,
    action: "CREATE",
    entityType: "Driver",
    entityId: driverId,
    entityLabel: parsed.data.fullName,
  });

  revalidatePath("/vozniki");
}

export type UpdateDriverState = { error?: string; success?: boolean } | undefined;

export async function updateDriver(
  driverId: string,
  _prevState: UpdateDriverState,
  formData: FormData
): Promise<UpdateDriverState> {
  const user = await requireUser();
  if (!user.canManageDrivers && !user.canManagePlatform) {
    return { error: "Nimaš dovoljenja za urejanje voznikov." };
  }

  const existing = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!existing) return { error: "Voznik ne obstaja." };
  if (!user.canManagePlatform && existing.tenantId !== user.tenantId) {
    return { error: "Ni dovoljeno." };
  }

  const parsed = driverSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone") || undefined,
    licenseNumber: formData.get("licenseNumber") || undefined,
    idMethod: formData.get("idMethod") || "RFID",
    idCode: formData.get("idCode") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neveljavni podatki." };
  }

  try {
    await prisma.driver.update({
      where: { id: driverId },
      data: {
        fullName: parsed.data.fullName,
        phone: parsed.data.phone || null,
        licenseNumber: parsed.data.licenseNumber || null,
        idMethod: parsed.data.idMethod,
        idCode: parsed.data.idCode || null,
      },
    });
  } catch {
    return { error: "Voznik s to ID kodo že obstaja." };
  }

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    tenantId: existing.tenantId,
    action: "UPDATE",
    entityType: "Driver",
    entityId: driverId,
    entityLabel: existing.fullName,
    changes: diffFields(existing, parsed.data),
  });

  revalidatePath("/vozniki");
  return { success: true };
}

export type DeleteDriversState = { error?: string; deleted?: number; failed?: string[] } | undefined;

export async function deleteDrivers(driverIds: string[]): Promise<DeleteDriversState> {
  const user = await requireUser();
  if (!user.canManagePlatform) {
    return { error: "Množično brisanje voznikov je na voljo samo administratorju." };
  }
  if (driverIds.length === 0) return { error: "Ni izbranih voznikov." };

  const drivers = await prisma.driver.findMany({
    where: { id: { in: driverIds } },
    select: { id: true, fullName: true, tenantId: true },
  });

  let deleted = 0;
  const failed: string[] = [];

  for (const d of drivers) {
    try {
      await prisma.driver.delete({ where: { id: d.id } });
      deleted++;
      await logAudit({
        userId: user.id,
        userEmail: user.email,
        tenantId: d.tenantId,
        action: "DELETE",
        entityType: "Driver",
        entityId: d.id,
        entityLabel: d.fullName,
      });
    } catch {
      failed.push(d.fullName);
    }
  }

  revalidatePath("/vozniki");
  revalidatePath("/vozila");
  revalidatePath("/zemljevid");
  return { deleted, failed: failed.length > 0 ? failed : undefined };
}

export async function assignDriverToVehicle(driverId: string, vehicleId: string) {
  const user = await requirePermission("canManageDrivers");
  if (!user.tenantId) throw new Error("Ni dovoljeno.");

  if (vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle || vehicle.tenantId !== user.tenantId) throw new Error("Vozilo ni na voljo.");
    await prisma.vehicle.update({ where: { id: vehicleId }, data: { currentDriverId: driverId } });
  } else {
    await prisma.vehicle.updateMany({ where: { currentDriverId: driverId, tenantId: user.tenantId }, data: { currentDriverId: null } });
  }
  revalidatePath("/vozniki");
  revalidatePath("/vozila");
  revalidatePath("/zemljevid");
}

export type ImportDriversState = { error?: string; created?: number; errors?: string[] } | undefined;

export async function importDriversXlsx(_prevState: ImportDriversState, formData: FormData): Promise<ImportDriversState> {
  await requirePlatformAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Izberi xlsx datoteko." };
  }

  let rows: Record<string, string>[];
  try {
    rows = await parseXlsxRows(file);
  } catch {
    return { error: "Datoteke ni bilo mogoče prebrati. Preveri, da je v xlsx formatu." };
  }
  if (rows.length === 0) return { error: "Datoteka ne vsebuje podatkov." };

  const tenants = await prisma.tenant.findMany({ where: { isActive: true }, select: { id: true, name: true } });
  const tenantIdByName = new Map(tenants.map((t) => [t.name.toLowerCase(), t.id]));

  let created = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowLabel = `Vrstica ${i + 2}`;

    const fullName = findColumn(row, "Ime", "Ime in priimek");
    const tenantName = findColumn(row, "Podjetje");
    const idCode = findColumn(row, "ID koda", "ID Koda", "IDkoda");

    if (!fullName) {
      errors.push(`${rowLabel}: manjka ime.`);
      continue;
    }
    if (!tenantName) {
      errors.push(`${rowLabel}: manjka podjetje.`);
      continue;
    }
    const tenantId = tenantIdByName.get(tenantName.toLowerCase());
    if (!tenantId) {
      errors.push(`${rowLabel}: podjetje "${tenantName}" ne obstaja.`);
      continue;
    }

    try {
      await prisma.driver.create({ data: { tenantId, fullName, idCode: idCode || undefined } });
      created++;
    } catch {
      errors.push(`${rowLabel}: voznik s to ID kodo že obstaja.`);
    }
  }

  revalidatePath("/vozniki");
  return { created, errors: errors.length > 0 ? errors : undefined };
}
