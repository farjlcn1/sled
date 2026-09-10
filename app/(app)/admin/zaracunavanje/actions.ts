"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { diffFields, logAudit } from "@/lib/audit";
import { generateInvoiceForTenant } from "@/lib/invoice";

export async function setVehicleSubscription(vehicleId: string, subscriptionId: string | null) {
  const user = await requirePlatformAdmin();
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) throw new Error("Vozilo ne obstaja.");

  // Paket mora pripadati ISTEMU podjetju kot vozilo in biti aktiven -- sicer bi lahko vozilo
  // pomotoma zaračunavalo po ceni paketa nekega drugega podjetja ali po že preklicanem paketu.
  if (subscriptionId) {
    const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub || sub.tenantId !== vehicle.tenantId || sub.status !== "ACTIVE") {
      throw new Error("Neveljaven paket za to podjetje.");
    }
  }

  await prisma.vehicle.update({ where: { id: vehicleId }, data: { subscriptionId } });
  await logAudit({
    userId: user.id,
    userEmail: user.email,
    tenantId: vehicle.tenantId,
    action: "UPDATE",
    entityType: "Vehicle",
    entityId: vehicleId,
    entityLabel: vehicle.plate,
    changes: diffFields(vehicle, { subscriptionId }),
  });
  revalidatePath("/admin/zaracunavanje");
}

export async function setVehicleBilling(vehicleId: string, billingEnabled: boolean) {
  const user = await requirePlatformAdmin();
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) throw new Error("Vozilo ne obstaja.");

  await prisma.vehicle.update({ where: { id: vehicleId }, data: { billingEnabled } });
  await logAudit({
    userId: user.id,
    userEmail: user.email,
    tenantId: vehicle.tenantId,
    action: "UPDATE",
    entityType: "Vehicle",
    entityId: vehicleId,
    entityLabel: vehicle.plate,
    changes: diffFields(vehicle, { billingEnabled }),
  });
  revalidatePath("/admin/zaracunavanje");
}

export async function bulkSetVehicleBilling(vehicleIds: string[], billingEnabled: boolean) {
  const user = await requirePlatformAdmin();
  if (vehicleIds.length === 0) return;

  const vehicles = await prisma.vehicle.findMany({ where: { id: { in: vehicleIds } } });
  await prisma.vehicle.updateMany({ where: { id: { in: vehicleIds } }, data: { billingEnabled } });

  for (const v of vehicles) {
    await logAudit({
      userId: user.id,
      userEmail: user.email,
      tenantId: v.tenantId,
      action: "UPDATE",
      entityType: "Vehicle",
      entityId: v.id,
      entityLabel: v.plate,
      changes: diffFields(v, { billingEnabled }),
    });
  }
  revalidatePath("/admin/zaracunavanje");
}

const billingSettingsSchema = z.object({
  billingEmail: z.union([z.string().trim().email("Neveljaven e-poštni naslov."), z.literal("")]),
  autoSendInvoice: z.boolean(),
});

export type BillingSettingsState = { error?: string; success?: boolean } | undefined;

export async function updateTenantBillingSettings(
  tenantId: string,
  _prevState: BillingSettingsState,
  formData: FormData
): Promise<BillingSettingsState> {
  const user = await requirePlatformAdmin();
  const existing = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!existing) return { error: "Podjetje ne obstaja." };

  const parsed = billingSettingsSchema.safeParse({
    billingEmail: formData.get("billingEmail") || "",
    autoSendInvoice: formData.get("autoSendInvoice") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Neveljavni podatki." };

  const billingEmail = parsed.data.billingEmail || null;
  if (parsed.data.autoSendInvoice && !billingEmail) {
    return { error: "Za samodejno pošiljanje po e-pošti je potreben e-poštni naslov." };
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { billingEmail, autoSendInvoice: parsed.data.autoSendInvoice },
  });
  await logAudit({
    userId: user.id,
    userEmail: user.email,
    action: "UPDATE",
    entityType: "Tenant",
    entityId: tenantId,
    entityLabel: existing.name,
    changes: diffFields(existing, { billingEmail, autoSendInvoice: parsed.data.autoSendInvoice }),
  });
  revalidatePath("/admin/zaracunavanje");
  return { success: true };
}

export type GenerateInvoiceActionResult = { invoiceId?: string; error?: string };

export async function generateCurrentInvoice(tenantId: string): Promise<GenerateInvoiceActionResult> {
  const user = await requirePlatformAdmin();
  const now = new Date();
  const result = await generateInvoiceForTenant(tenantId, now.getFullYear(), now.getMonth() + 1);
  if ("error" in result) return { error: result.error };

  if (result.created) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    await logAudit({
      userId: user.id,
      userEmail: user.email,
      tenantId,
      action: "CREATE",
      entityType: "Invoice",
      entityId: result.invoiceId,
      entityLabel: tenant?.name ?? tenantId,
    });
  }
  revalidatePath("/admin/zaracunavanje");
  return { invoiceId: result.invoiceId };
}
