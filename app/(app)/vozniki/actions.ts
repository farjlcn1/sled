"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission, requirePlatformAdmin } from "@/lib/auth/session";
import { parseXlsxRows, findColumn } from "@/lib/xlsx-import";

const driverSchema = z.object({
  fullName: z.string().trim().min(1, "Vnesi ime voznika."),
  phone: z.string().optional(),
  licenseNumber: z.string().optional(),
  idMethod: z.enum(["IBUTTON", "RFID", "MANUAL"]).default("RFID"),
  idCode: z.string().optional(),
});

export type DriverState = { error?: string } | undefined;

export async function createDriver(_prevState: DriverState, formData: FormData): Promise<DriverState> {
  const user = await requirePermission("canManageDrivers");
  if (!user.tenantId) {
    return { error: "Uporabnik brez podjetja ne more dodajati voznikov." };
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
    await prisma.driver.create({
      data: {
        tenantId: user.tenantId,
        fullName: parsed.data.fullName,
        phone: parsed.data.phone,
        licenseNumber: parsed.data.licenseNumber,
        idMethod: parsed.data.idMethod,
        idCode: parsed.data.idCode,
      },
    });
  } catch {
    return { error: "Voznik s to ID kodo že obstaja." };
  }

  revalidatePath("/vozniki");
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
