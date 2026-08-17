"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { createTraccarDevice, deleteTraccarDevice } from "@/lib/traccar";
import { parseXlsxRows, findColumn } from "@/lib/xlsx-import";
import { logAudit } from "@/lib/audit";
import { sendSms } from "@/lib/sms-gateway";

const deviceSchema = z.object({
  imei: z
    .string()
    .trim()
    .regex(/^\d{10,17}$/, "IMEI mora vsebovati med 10 in 17 številk."),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  simNumber: z.string().optional(),
  note: z.string().optional(),
});

export type DeviceState = { error?: string } | undefined;

export async function createDevice(_prevState: DeviceState, formData: FormData): Promise<DeviceState> {
  await requirePlatformAdmin();

  const parsed = deviceSchema.safeParse({
    imei: formData.get("imei"),
    brand: formData.get("brand") || undefined,
    model: formData.get("model") || undefined,
    serialNumber: formData.get("serialNumber") || undefined,
    simNumber: formData.get("simNumber") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neveljavni podatki." };
  }

  const existing = await prisma.device.findUnique({ where: { imei: parsed.data.imei } });
  if (existing) {
    return { error: "Naprava s tem IMEI že obstaja." };
  }

  // Najprej registriraj v Traccarju, šele nato shrani lokalno — če Traccar zavrne,
  // se v naši bazi ne znajde naprava, ki dejansko ne bo sprejemala podatkov.
  let traccarDeviceId: number;
  try {
    const traccarDevice = await createTraccarDevice(parsed.data.imei, parsed.data.imei);
    traccarDeviceId = traccarDevice.id;
  } catch {
    return { error: "Napake pri registraciji naprave v Traccarju. Poskusi znova." };
  }

  await prisma.device.create({
    data: {
      imei: parsed.data.imei,
      brand: parsed.data.brand,
      model: parsed.data.model,
      serialNumber: parsed.data.serialNumber,
      simNumber: parsed.data.simNumber,
      note: parsed.data.note,
      traccarDeviceId,
    },
  });

  revalidatePath("/admin/naprave");
}

const updateDeviceSchema = z.object({
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  simNumber: z.string().optional(),
  note: z.string().optional(),
  protocol: z.enum(["TELTONIKA", "OTHER"]),
});

export type UpdateDeviceState = { error?: string; success?: boolean } | undefined;

export async function updateDevice(
  deviceId: string,
  _prevState: UpdateDeviceState,
  formData: FormData
): Promise<UpdateDeviceState> {
  await requirePlatformAdmin();

  const existing = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!existing) return { error: "Naprava ne obstaja." };

  const parsed = updateDeviceSchema.safeParse({
    brand: formData.get("brand") || undefined,
    model: formData.get("model") || undefined,
    serialNumber: formData.get("serialNumber") || undefined,
    simNumber: formData.get("simNumber") || undefined,
    note: formData.get("note") || undefined,
    protocol: formData.get("protocol") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neveljavni podatki." };
  }

  await prisma.device.update({
    where: { id: deviceId },
    data: {
      brand: parsed.data.brand || null,
      model: parsed.data.model || null,
      serialNumber: parsed.data.serialNumber || null,
      simNumber: parsed.data.simNumber || null,
      note: parsed.data.note || null,
      protocol: parsed.data.protocol,
    },
  });

  revalidatePath("/admin/naprave");
  return { success: true };
}

export async function assignDeviceToTenant(deviceId: string, tenantId: string) {
  await requirePlatformAdmin();

  if (tenantId) {
    const [tenant, deviceCount] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId } }),
      prisma.device.count({ where: { tenantId } }),
    ]);
    if (!tenant) throw new Error("Podjetje ne obstaja.");
    if (deviceCount >= tenant.deviceLimit) {
      throw new Error(`Podjetje je doseglo mejo ${tenant.deviceLimit} naprav.`);
    }
  }

  await prisma.device.update({
    where: { id: deviceId },
    data: { tenantId: tenantId || null },
  });
  revalidatePath("/admin/naprave");
}

export async function deleteDevice(id: string) {
  await requirePlatformAdmin();

  const device = await prisma.device.findUnique({ where: { id } });
  if (!device) return;

  if (device.traccarDeviceId) {
    await deleteTraccarDevice(device.traccarDeviceId).catch(() => undefined);
  }
  await prisma.device.delete({ where: { id } });
  revalidatePath("/admin/naprave");
}

export type ImportDevicesState = { error?: string; created?: number; errors?: string[] } | undefined;

export async function importDevicesXlsx(_prevState: ImportDevicesState, formData: FormData): Promise<ImportDevicesState> {
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

    const imei = findColumn(row, "IMEI");
    const brand = findColumn(row, "Znamka");
    const model = findColumn(row, "Model");
    const serialNumber = findColumn(row, "SRNO", "Serijska št.", "Serijska številka");
    const tenantName = findColumn(row, "Podjetje");
    const note = findColumn(row, "Opomba");
    const simNumber = findColumn(row, "SIM");

    if (!imei || !/^\d{10,17}$/.test(imei)) {
      errors.push(`${rowLabel}: neveljaven ali manjkajoč IMEI.`);
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

    const existing = await prisma.device.findUnique({ where: { imei } });
    if (existing) {
      errors.push(`${rowLabel}: naprava z IMEI ${imei} že obstaja.`);
      continue;
    }

    let traccarDeviceId: number;
    try {
      const traccarDevice = await createTraccarDevice(imei, brand && model ? `${brand} ${model}` : imei);
      traccarDeviceId = traccarDevice.id;
    } catch {
      errors.push(`${rowLabel}: napaka pri registraciji v Traccarju (IMEI ${imei}).`);
      continue;
    }

    await prisma.device.create({
      data: { imei, brand, model, serialNumber, simNumber, note, tenantId, traccarDeviceId },
    });
    created++;
  }

  revalidatePath("/admin/naprave");
  return { created, errors: errors.length > 0 ? errors : undefined };
}

export async function sendDeviceSms(deviceIds: string[], message: string): Promise<{ sent: number; failed: number }> {
  const user = await requirePlatformAdmin();

  const devices = await prisma.device.findMany({
    where: { id: { in: deviceIds } },
    select: { id: true, imei: true, simNumber: true, tenantId: true },
  });

  let sent = 0;
  let failed = 0;

  // Zaporedno, ne vzporedno — modem obdela en AT ukaz naenkrat (gateway sam to tudi
  // zavaruje z lock-om), zaporedno pošiljanje pa obenem ohrani berljiv vrstni red v reviziji.
  for (const device of devices) {
    if (!device.simNumber) {
      failed++;
      continue;
    }

    const result = await sendSms(device.simNumber, message);
    if (result.ok) sent++;
    else failed++;

    await logAudit({
      userId: user.id,
      userEmail: user.email,
      tenantId: user.tenantId ?? device.tenantId ?? null,
      action: "UPDATE",
      entityType: "Device",
      entityId: device.id,
      entityLabel: device.imei,
      changes: {
        smsSent: {
          from: null,
          to: result.ok ? message.slice(0, 200) : `NAPAKA: ${result.error}`,
        },
      },
    });
  }

  return { sent, failed };
}
