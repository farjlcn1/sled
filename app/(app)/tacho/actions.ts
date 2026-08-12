"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";
import { vehicleWhereForUser } from "@/lib/vehicle-access";
import { decode, TachoDecodeError } from "@/lib/tacho/decode";

async function requireManager() {
  const user = await requireUser();
  if (!user.canManageUsers) {
    throw new Error("Nimaš dovoljenja za upravljanje tahografskih podatkov.");
  }
  return user;
}

export async function toggleVehicleSchedule(vehicleId: string, enabled: boolean) {
  const user = await requireManager();
  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, ...vehicleWhereForUser(user) } });
  if (!vehicle) throw new Error("Vozilo ni na voljo.");
  await prisma.vehicle.update({ where: { id: vehicleId }, data: { tachoScheduleEnabled: enabled } });

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    tenantId: vehicle.tenantId,
    action: "UPDATE",
    entityType: "Vehicle",
    entityId: vehicleId,
    entityLabel: vehicle.plate,
    changes: { tachoScheduleEnabled: { from: vehicle.tachoScheduleEnabled, to: enabled } },
  });

  revalidatePath("/tacho");
}

export async function setAllVehicleSchedules(tenantId: string, enabled: boolean) {
  const user = await requireManager();
  if (!user.canManagePlatform && tenantId !== user.tenantId) throw new Error("Ni dovoljeno.");
  await prisma.vehicle.updateMany({ where: { tenantId }, data: { tachoScheduleEnabled: enabled } });

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    tenantId,
    action: "UPDATE",
    entityType: "Vehicle",
    entityId: null,
    entityLabel: tenantId,
    changes: { tachoScheduleEnabled: { from: null, to: enabled } },
  });

  revalidatePath("/tacho");
}

export async function toggleDriverSchedule(driverId: string, enabled: boolean) {
  const user = await requireManager();
  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver || (!user.canManagePlatform && driver.tenantId !== user.tenantId)) throw new Error("Voznik ni na voljo.");
  await prisma.driver.update({ where: { id: driverId }, data: { tachoScheduleEnabled: enabled } });

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    tenantId: driver.tenantId,
    action: "UPDATE",
    entityType: "Driver",
    entityId: driverId,
    entityLabel: driver.fullName,
    changes: { tachoScheduleEnabled: { from: driver.tachoScheduleEnabled, to: enabled } },
  });

  revalidatePath("/tacho");
}

export async function setAllDriverSchedules(tenantId: string, enabled: boolean) {
  const user = await requireManager();
  if (!user.canManagePlatform && tenantId !== user.tenantId) throw new Error("Ni dovoljeno.");
  await prisma.driver.updateMany({ where: { tenantId }, data: { tachoScheduleEnabled: enabled } });

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    tenantId,
    action: "UPDATE",
    entityType: "Driver",
    entityId: null,
    entityLabel: tenantId,
    changes: { tachoScheduleEnabled: { from: null, to: enabled } },
  });

  revalidatePath("/tacho");
}

export async function setDriverPeriod(driverId: string, days: number) {
  const user = await requireManager();
  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver || (!user.canManagePlatform && driver.tenantId !== user.tenantId)) throw new Error("Voznik ni na voljo.");
  if (!Number.isFinite(days) || days < 1 || days > 90) throw new Error("Obdobje mora biti med 1 in 90 dni.");
  const roundedDays = Math.round(days);
  await prisma.driver.update({ where: { id: driverId }, data: { tachoDownloadPeriodDays: roundedDays } });

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    tenantId: driver.tenantId,
    action: "UPDATE",
    entityType: "Driver",
    entityId: driverId,
    entityLabel: driver.fullName,
    changes: { tachoDownloadPeriodDays: { from: driver.tachoDownloadPeriodDays, to: roundedDays } },
  });

  revalidatePath("/tacho");
}

export type UploadState = { error?: string; success?: boolean } | undefined;

export async function uploadTachoFile(_prevState: UploadState, formData: FormData): Promise<UploadState> {
  const user = await requireManager();

  const kind = formData.get("kind");
  const vehicleId = formData.get("vehicleId");
  const driverId = formData.get("driverId");
  const file = formData.get("file");

  if (kind !== "VOZILO" && kind !== "VOZNIK") {
    return { error: "Izberi tip datoteke." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Izberi datoteko." };
  }

  let tenantId: string;
  if (kind === "VOZILO") {
    if (typeof vehicleId !== "string" || !vehicleId) return { error: "Izberi vozilo." };
    const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, ...vehicleWhereForUser(user) } });
    if (!vehicle) return { error: "Vozilo ni na voljo." };
    tenantId = vehicle.tenantId;
  } else {
    if (typeof driverId !== "string" || !driverId) return { error: "Izberi voznika." };
    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver || (!user.canManagePlatform && driver.tenantId !== user.tenantId)) return { error: "Voznik ni na voljo." };
    tenantId = driver.tenantId;
  }

  const arrayBuffer = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);

  let periodFrom: Date | null = null;
  let periodTo: Date | null = null;
  try {
    const parsed = decode(buf);
    if (parsed.kind === "VOZILO") {
      periodFrom = parsed.periodFrom;
      periodTo = parsed.periodTo;
    } else if (parsed.activities.length > 0) {
      const times = parsed.activities.map((a) => a.time.getTime());
      periodFrom = new Date(Math.min(...times));
      periodTo = new Date(Math.max(...times));
    }
  } catch (e) {
    if (e instanceof TachoDecodeError) {
      return { error: `Datoteke ni bilo mogoče prebrati: ${e.message}` };
    }
    return { error: "Datoteke ni bilo mogoče prebrati." };
  }

  const tachoFile = await prisma.tachoFile.create({
    data: {
      tenantId,
      kind,
      vehicleId: kind === "VOZILO" ? (vehicleId as string) : null,
      driverId: kind === "VOZNIK" ? (driverId as string) : null,
      fileName: file.name,
      fileSize: buf.length,
      periodFrom,
      periodTo,
      rawData: buf,
    },
  });

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    tenantId,
    action: "CREATE",
    entityType: "TachoFile",
    entityId: tachoFile.id,
    entityLabel: file.name,
  });

  revalidatePath("/tacho");
  return { success: true };
}

export async function deleteTachoFile(id: string) {
  const user = await requireManager();
  const file = await prisma.tachoFile.findUnique({ where: { id } });
  if (!file || (!user.canManagePlatform && file.tenantId !== user.tenantId)) throw new Error("Ni dovoljeno.");
  await prisma.tachoFile.delete({ where: { id } });

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    tenantId: file.tenantId,
    action: "DELETE",
    entityType: "TachoFile",
    entityId: id,
    entityLabel: file.fileName,
  });

  revalidatePath("/tacho");
}
