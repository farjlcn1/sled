"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { logAudit, diffFields } from "@/lib/audit";
import { startPrivateModeForVehicle, endPrivateModeForVehicle } from "@/lib/private-mode";

const stopSettingsSchema = z.object({
  minStopDurationMin: z.coerce.number().int().min(1).max(180),
  minMovingSpeedKmh: z.coerce.number().min(1).max(50),
});

const vehicleSchema = z.object({
  plate: z.string().trim().min(1, "Vnesi registrsko številko."),
  brand: z.string().optional(),
  model: z.string().optional(),
  year: z.coerce.number().int().optional(),
  note: z.string().optional(),
  icon: z.enum(["CAR", "VAN", "TRUCK", "EXCAVATOR", "TRACTOR", "MOTORCYCLE"]).default("CAR"),
  fuelTankVolumeL: z.coerce.number().positive().optional(),
  registrationDate: z.string().optional(),
  nextServiceDate: z.string().optional(),
  nextServiceKm: z.coerce.number().optional(),
  deviceId: z.string().optional(),
  groupId: z.string().optional(),
  tenantId: z.string().optional(),
  din1Label: z.string().optional(),
  din2Label: z.string().optional(),
  din3Label: z.string().optional(),
  din4Label: z.string().optional(),
  din5Label: z.string().optional(),
  din6Label: z.string().optional(),
  privateModeDin: z.coerce.number().int().min(1).max(6).optional(),
});

export type VehicleState = { error?: string } | undefined;

export async function createVehicle(_prevState: VehicleState, formData: FormData): Promise<VehicleState> {
  const user = await requireUser();
  if (!user.canManageVehicles && !user.canManagePlatform) {
    return { error: "Nimaš dovoljenja za dodajanje vozil." };
  }

  const parsed = vehicleSchema.safeParse({
    plate: formData.get("plate"),
    brand: formData.get("brand") || undefined,
    model: formData.get("model") || undefined,
    year: formData.get("year") || undefined,
    note: formData.get("note") || undefined,
    icon: formData.get("icon") || undefined,
    fuelTankVolumeL: formData.get("fuelTankVolumeL") || undefined,
    registrationDate: formData.get("registrationDate") || undefined,
    nextServiceDate: formData.get("nextServiceDate") || undefined,
    nextServiceKm: formData.get("nextServiceKm") || undefined,
    deviceId: formData.get("deviceId") || undefined,
    groupId: formData.get("groupId") || undefined,
    tenantId: formData.get("tenantId") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neveljavni podatki." };
  }

  let tenantId: string;
  if (user.tenantId) {
    tenantId = user.tenantId;
  } else if (user.canManagePlatform && parsed.data.tenantId) {
    tenantId = parsed.data.tenantId;
  } else {
    return { error: "Izberi podjetje." };
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return { error: "Podjetje ne obstaja." };

  const vehicleCount = await prisma.vehicle.count({ where: { tenantId } });
  if (vehicleCount >= tenant.deviceLimit) {
    return { error: `Dosežena je meja ${tenant.deviceLimit} vozil/naprav za to podjetje.` };
  }

  if (parsed.data.deviceId) {
    const device = await prisma.device.findUnique({ where: { id: parsed.data.deviceId } });
    if (!device || device.tenantId !== tenantId) {
      return { error: "Izbrana naprava ni na voljo za to podjetje." };
    }
  }

  if (parsed.data.groupId) {
    const group = await prisma.vehicleGroup.findUnique({ where: { id: parsed.data.groupId } });
    if (!group || group.tenantId !== tenantId) {
      return { error: "Izbrana skupina ni na voljo za to podjetje." };
    }
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      tenantId,
      plate: parsed.data.plate,
      brand: parsed.data.brand,
      model: parsed.data.model,
      year: parsed.data.year,
      note: parsed.data.note,
      icon: parsed.data.icon,
      fuelTankVolumeL: parsed.data.fuelTankVolumeL,
      registrationDate: parsed.data.registrationDate ? new Date(parsed.data.registrationDate) : null,
      nextServiceDate: parsed.data.nextServiceDate ? new Date(parsed.data.nextServiceDate) : null,
      nextServiceKm: parsed.data.nextServiceKm ?? null,
      deviceId: parsed.data.deviceId,
    },
  });

  if (parsed.data.groupId) {
    await prisma.vehicleGroupMembership.create({ data: { vehicleId: vehicle.id, groupId: parsed.data.groupId } });
  }

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    tenantId: user.tenantId,
    action: "CREATE",
    entityType: "Vehicle",
    entityId: vehicle.id,
    entityLabel: vehicle.plate,
  });

  revalidatePath("/vozila");
  revalidatePath("/zemljevid");
}

export type UpdateVehicleState = { error?: string; success?: boolean } | undefined;

export async function updateVehicle(
  vehicleId: string,
  _prevState: UpdateVehicleState,
  formData: FormData
): Promise<UpdateVehicleState> {
  const user = await requireUser();
  if (!user.canManageVehicles && !user.canManagePlatform) {
    return { error: "Nimaš dovoljenja za urejanje vozil." };
  }

  const existing = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!existing) return { error: "Vozilo ne obstaja." };
  if (!user.canManagePlatform && existing.tenantId !== user.tenantId) {
    return { error: "Ni dovoljeno." };
  }

  const parsed = vehicleSchema.safeParse({
    plate: formData.get("plate"),
    brand: formData.get("brand") || undefined,
    model: formData.get("model") || undefined,
    year: formData.get("year") || undefined,
    note: formData.get("note") || undefined,
    icon: formData.get("icon") || undefined,
    fuelTankVolumeL: formData.get("fuelTankVolumeL") || undefined,
    registrationDate: formData.get("registrationDate") || undefined,
    nextServiceDate: formData.get("nextServiceDate") || undefined,
    nextServiceKm: formData.get("nextServiceKm") || undefined,
    deviceId: formData.get("deviceId") || undefined,
    din1Label: formData.get("din1Label") || undefined,
    din2Label: formData.get("din2Label") || undefined,
    din3Label: formData.get("din3Label") || undefined,
    din4Label: formData.get("din4Label") || undefined,
    din5Label: formData.get("din5Label") || undefined,
    din6Label: formData.get("din6Label") || undefined,
    privateModeDin: formData.get("privateModeDin") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neveljavni podatki." };
  }

  if (parsed.data.deviceId) {
    const device = await prisma.device.findUnique({ where: { id: parsed.data.deviceId } });
    if (!device || device.tenantId !== existing.tenantId) {
      return { error: "Izbrana naprava ni na voljo za to podjetje." };
    }
  }

  try {
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        plate: parsed.data.plate,
        brand: parsed.data.brand || null,
        model: parsed.data.model || null,
        year: parsed.data.year ?? null,
        note: parsed.data.note || null,
        icon: parsed.data.icon,
        fuelTankVolumeL: parsed.data.fuelTankVolumeL ?? null,
        registrationDate: parsed.data.registrationDate ? new Date(parsed.data.registrationDate) : null,
        nextServiceDate: parsed.data.nextServiceDate ? new Date(parsed.data.nextServiceDate) : null,
        nextServiceKm: parsed.data.nextServiceKm ?? null,
        deviceId: parsed.data.deviceId || null,
        din1Label: parsed.data.din1Label || null,
        din2Label: parsed.data.din2Label || null,
        din3Label: parsed.data.din3Label || null,
        din4Label: parsed.data.din4Label || null,
        din5Label: parsed.data.din5Label || null,
        din6Label: parsed.data.din6Label || null,
        privateModeDin: parsed.data.privateModeDin ?? null,
      },
    });
  } catch {
    return { error: "Napaka pri shranjevanju — preveri, da registrska št. in naprava nista že v uporabi." };
  }

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    tenantId: user.tenantId,
    action: "UPDATE",
    entityType: "Vehicle",
    entityId: vehicleId,
    entityLabel: existing.plate,
    changes: diffFields(existing, parsed.data as Partial<typeof existing>),
  });

  revalidatePath("/vozila");
  revalidatePath(`/vozila/${vehicleId}`);
  revalidatePath("/zemljevid");
  return { success: true };
}

export type UpdatePlateState = { error?: string; success?: boolean } | undefined;

// Ozek popravek samo registrske -- za mobilni zavihek Vozila, ki namerno ne izpostavlja celotnega
// vehicleSchema (znamka/model/servis/DIN itd.). Ne uporablja updateVehicle, ker bi manjkajoča
// polja v FormData tam tiho počistila obstoječe vrednosti (icon celo pade nazaj na "CAR" prek
// .default()), ne pa jih pustila nedotaknjene.
export async function updateVehiclePlate(
  vehicleId: string,
  _prevState: UpdatePlateState,
  formData: FormData
): Promise<UpdatePlateState> {
  const user = await requireUser();
  if (!user.canManageVehicles && !user.canManagePlatform) {
    return { error: "Nimaš dovoljenja za urejanje vozil." };
  }

  const existing = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!existing) return { error: "Vozilo ne obstaja." };
  if (!user.canManagePlatform && existing.tenantId !== user.tenantId) {
    return { error: "Ni dovoljeno." };
  }

  const trimmed = String(formData.get("plate") ?? "").trim();
  if (!trimmed) return { error: "Vnesi registrsko številko." };

  try {
    await prisma.vehicle.update({ where: { id: vehicleId }, data: { plate: trimmed } });
  } catch {
    return { error: "Napaka pri shranjevanju — ta registrska št. je že v uporabi." };
  }

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    tenantId: user.tenantId,
    action: "UPDATE",
    entityType: "Vehicle",
    entityId: vehicleId,
    entityLabel: trimmed,
    changes: { plate: { from: existing.plate, to: trimmed } },
  });

  revalidatePath("/vozila");
  revalidatePath(`/vozila/${vehicleId}`);
  revalidatePath("/zemljevid");
  revalidatePath("/mobilna");
  revalidatePath("/mobilna/vozila");
  revalidatePath(`/mobilna/vozila/${vehicleId}`);
  return { success: true };
}

export type ArchiveVehicleState = { error?: string; success?: boolean } | undefined;

// Odveže sledilno napravo od vozila in vozilo doda v arhivsko skupino tega najemnika (glej
// isArchiveGroup na VehicleGroup) -- uporablja se, ko se naprava fizično demontira, podatki
// vozila pa morajo ostati dosegljivi (samo pod zavihkom "Arhiv" na zemljevidu, ne več med
// aktivnimi vozili). Idempotentno -- ponoven klic na že arhiviranem vozilu ne vrne napake.
export async function archiveVehicle(vehicleId: string): Promise<ArchiveVehicleState> {
  const user = await requireUser();
  if (!user.canManageVehicles && !user.canManagePlatform) {
    return { error: "Nimaš dovoljenja za arhiviranje vozil." };
  }

  const existing = await prisma.vehicle.findUnique({ where: { id: vehicleId }, include: { device: true } });
  if (!existing) return { error: "Vozilo ne obstaja." };
  if (!user.canManagePlatform && existing.tenantId !== user.tenantId) {
    return { error: "Ni dovoljeno." };
  }

  const archiveGroup = await prisma.vehicleGroup.findFirst({
    where: { tenantId: existing.tenantId, isArchiveGroup: true },
  });
  if (!archiveGroup) return { error: "Podjetje nima arhivske skupine — obrni se na administratorja." };

  // Traccar ID trenutne naprave (če obstaja) zabeležimo v archivedTraccarDeviceId PREDEN deviceId
  // sname -- brez tega bi zgodovina pozicij postala nedosegljiva, saj computeHistoryRows zgodovino
  // bere prek te ID, ne prek našega Device zapisa. Če vozilo nima trenutne naprave (npr. ponovno
  // arhiviranje), obstoječo zabeleženo vrednost pustimo pri miru.
  const archivedTraccarDeviceId = existing.device?.traccarDeviceId ?? existing.archivedTraccarDeviceId;

  await prisma.$transaction(async (tx) => {
    await tx.vehicle.update({ where: { id: vehicleId }, data: { deviceId: null, archivedTraccarDeviceId } });
    const membership = await tx.vehicleGroupMembership.findUnique({
      where: { vehicleId_groupId: { vehicleId, groupId: archiveGroup.id } },
    });
    if (!membership) {
      await tx.vehicleGroupMembership.create({ data: { vehicleId, groupId: archiveGroup.id } });
    }
  });

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    tenantId: existing.tenantId,
    action: "UPDATE",
    entityType: "Vehicle",
    entityId: vehicleId,
    entityLabel: existing.plate,
    changes: { deviceId: { from: existing.deviceId, to: null }, archived: { from: false, to: true } },
  });

  revalidatePath("/vozila");
  revalidatePath(`/vozila/${vehicleId}`);
  revalidatePath("/zemljevid");
  return { success: true };
}

export type DeleteVehiclesState = { error?: string; deleted?: number; failed?: string[] } | undefined;

export async function deleteVehicles(vehicleIds: string[]): Promise<DeleteVehiclesState> {
  const user = await requireUser();
  if (!user.canManagePlatform) {
    return { error: "Množično brisanje vozil je na voljo samo administratorju." };
  }
  if (vehicleIds.length === 0) return { error: "Ni izbranih vozil." };

  const vehicles = await prisma.vehicle.findMany({
    where: { id: { in: vehicleIds } },
    select: { id: true, plate: true },
  });

  let deleted = 0;
  const failed: string[] = [];

  for (const v of vehicles) {
    try {
      await prisma.vehicle.delete({ where: { id: v.id } });
      deleted++;
      await logAudit({
        userId: user.id,
        userEmail: user.email,
        tenantId: user.tenantId,
        action: "DELETE",
        entityType: "Vehicle",
        entityId: v.id,
        entityLabel: v.plate,
      });
    } catch {
      failed.push(`${v.plate} (ima povezane potne naloge ali tahografske datoteke)`);
    }
  }

  revalidatePath("/vozila");
  revalidatePath("/zemljevid");
  revalidatePath("/skupine");
  return { deleted, failed: failed.length > 0 ? failed : undefined };
}

export type SaveMembershipsState = { error?: string } | undefined;

// Skupinska (šele ob kliku na "Shrani") sprememba pripadnosti skupinam — glej GroupsMatrix,
// ki spremembe do takrat hrani samo lokalno v brskalniku.
export async function saveGroupMemberships(
  changes: { groupId: string; vehicleId: string; inGroup: boolean }[]
): Promise<SaveMembershipsState> {
  const user = await requireUser();
  if (!user.canManageVehicles && !user.canManagePlatform) return { error: "Ni dovoljeno." };

  await Promise.all(
    changes.map((change) =>
      change.inGroup
        ? prisma.vehicleGroupMembership
            .create({ data: { groupId: change.groupId, vehicleId: change.vehicleId } })
            .catch(() => undefined)
        : prisma.vehicleGroupMembership.deleteMany({
            where: { groupId: change.groupId, vehicleId: change.vehicleId },
          })
    )
  );

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    tenantId: user.tenantId,
    action: "UPDATE",
    entityType: "VehicleGroup",
    entityLabel: `${changes.length} sprememb pripadnosti skupinam`,
    changes: { pairs: { from: null, to: changes } },
  });

  revalidatePath("/vozila");
  revalidatePath("/uporabniki");
  revalidatePath("/skupine");
}

export async function createVehicleGroup(_prevState: VehicleState, formData: FormData): Promise<VehicleState> {
  const user = await requireUser();
  if (!user.canManageVehicles && !user.canManagePlatform) return { error: "Ni dovoljeno." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Vnesi ime skupine." };

  const tenantId = user.tenantId || String(formData.get("tenantId") ?? "");
  if (!tenantId) return { error: "Izberi podjetje." };

  try {
    await prisma.vehicleGroup.create({ data: { tenantId, name } });
  } catch {
    return { error: "Skupina s tem imenom že obstaja." };
  }

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    tenantId: user.tenantId,
    action: "CREATE",
    entityType: "VehicleGroup",
    entityLabel: name,
  });

  revalidatePath("/vozila");
  revalidatePath("/uporabniki");
}

export type StopSettingsState = { error?: string } | undefined;

export async function updateStopSettings(
  vehicleId: string,
  _prevState: StopSettingsState,
  formData: FormData
): Promise<StopSettingsState> {
  const user = await requireUser();
  if (!user.tenantId) return { error: "Ni dovoljeno." };

  const parsed = stopSettingsSchema.safeParse({
    minStopDurationMin: formData.get("minStopDurationMin"),
    minMovingSpeedKmh: formData.get("minMovingSpeedKmh"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neveljavni podatki." };
  }

  await prisma.vehicle.updateMany({
    where: { id: vehicleId, tenantId: user.tenantId },
    data: parsed.data,
  });
  revalidatePath("/vozila");
}

// Vklopi zasebni način (ročno, glej tudi scripts/private-mode-sync.ts za samodejni preklop po DIN).
export async function startPrivateMode(vehicleId: string, retentionTier: "BASIC" | "WITH_MILEAGE") {
  const user = await requireUser();
  if (!user.canManageVehicles && !user.canManagePlatform) throw new Error("Ni dovoljeno.");

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) throw new Error("Vozilo ne obstaja.");
  if (!user.canManagePlatform && vehicle.tenantId !== user.tenantId) throw new Error("Ni dovoljeno.");

  await startPrivateModeForVehicle(vehicleId, retentionTier);

  revalidatePath("/vozila");
  revalidatePath(`/vozila/${vehicleId}`);
  revalidatePath("/zemljevid");
}

export async function endPrivateMode(vehicleId: string) {
  const user = await requireUser();
  if (!user.canManageVehicles && !user.canManagePlatform) throw new Error("Ni dovoljeno.");

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) throw new Error("Vozilo ne obstaja.");
  if (!user.canManagePlatform && vehicle.tenantId !== user.tenantId) throw new Error("Ni dovoljeno.");

  await endPrivateModeForVehicle(vehicleId);

  revalidatePath("/vozila");
  revalidatePath(`/vozila/${vehicleId}`);
  revalidatePath("/zemljevid");
}

// Kateri živi podatki naj bodo prikazani v podrobnem pogledu vozila — velja za tega uporabnika,
// ne glede na katero vozilo gleda (shranjeno, ni treba izbirati ob vsaki prijavi).
export async function updateVisibleVehicleFields(fields: string[]) {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { visibleVehicleFields: fields } });
  revalidatePath("/zemljevid");
}
