"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { diffFields, logAudit } from "@/lib/audit";
import { generateInvoiceForTenant } from "@/lib/invoice";

export type VehicleBillingEntry = { vehicleId: string; subscriptionId: string | null; billingEnabled: boolean };

// Spremembe paketa/zaračunavanja se v tabeli hranijo samo lokalno, dokler uporabnik ne klikne
// "Shrani" (isti vzorec kot GroupsMatrix v skupine/) -- ta akcija takrat naenkrat potrdi CELOTNO
// stanje vseh vozil tega podjetja, ne le spremenjenih vrstic.
export async function saveVehicleBilling(
  tenantId: string,
  entries: VehicleBillingEntry[]
): Promise<{ error?: string; success?: boolean }> {
  const user = await requirePlatformAdmin();
  if (entries.length === 0) return { success: true };

  const vehicles = await prisma.vehicle.findMany({ where: { tenantId } });
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));

  const subscriptionIds = [...new Set(entries.map((e) => e.subscriptionId).filter((id): id is string => id !== null))];
  const validSubs = await prisma.subscription.findMany({
    where: { id: { in: subscriptionIds }, tenantId, status: "ACTIVE" },
    select: { id: true },
  });
  const validSubIds = new Set(validSubs.map((s) => s.id));
  for (const e of entries) {
    if (e.subscriptionId && !validSubIds.has(e.subscriptionId)) {
      return { error: "Eno od izbranih vozil ima neveljaven paket za to podjetje." };
    }
    if (!vehicleById.has(e.vehicleId)) {
      return { error: "Eno od vozil ne pripada temu podjetju." };
    }
  }

  const changed = entries.filter((e) => {
    const v = vehicleById.get(e.vehicleId)!;
    return v.subscriptionId !== e.subscriptionId || v.billingEnabled !== e.billingEnabled;
  });

  await Promise.all(
    changed.map((e) =>
      prisma.vehicle.update({
        where: { id: e.vehicleId },
        data: { subscriptionId: e.subscriptionId, billingEnabled: e.billingEnabled },
      })
    )
  );

  for (const e of changed) {
    const v = vehicleById.get(e.vehicleId)!;
    await logAudit({
      userId: user.id,
      userEmail: user.email,
      tenantId,
      action: "UPDATE",
      entityType: "Vehicle",
      entityId: e.vehicleId,
      entityLabel: v.plate,
      changes: diffFields(v, { subscriptionId: e.subscriptionId, billingEnabled: e.billingEnabled }),
    });
  }

  revalidatePath("/admin/zaracunavanje");
  return { success: true };
}

const billingSettingsSchema = z.object({
  billingEmail: z.union([z.string().trim().email("Neveljaven e-poštni naslov."), z.literal("")]),
  autoSendInvoice: z.boolean(),
  billingAddress: z.string().trim().optional(),
  taxId: z.string().trim().optional(),
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
    billingAddress: formData.get("billingAddress") || undefined,
    taxId: formData.get("taxId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Neveljavni podatki." };

  const billingEmail = parsed.data.billingEmail || null;
  if (parsed.data.autoSendInvoice && !billingEmail) {
    return { error: "Za samodejno pošiljanje po e-pošti je potreben e-poštni naslov." };
  }

  const data = {
    billingEmail,
    autoSendInvoice: parsed.data.autoSendInvoice,
    billingAddress: parsed.data.billingAddress || null,
    taxId: parsed.data.taxId || null,
  };

  await prisma.tenant.update({ where: { id: tenantId }, data });
  await logAudit({
    userId: user.id,
    userEmail: user.email,
    action: "UPDATE",
    entityType: "Tenant",
    entityId: tenantId,
    entityLabel: existing.name,
    changes: diffFields(existing, data),
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

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  await logAudit({
    userId: user.id,
    userEmail: user.email,
    tenantId,
    action: result.status === "created" ? "CREATE" : "UPDATE",
    entityType: "Invoice",
    entityId: result.invoiceId,
    entityLabel: tenant?.name ?? tenantId,
  });

  revalidatePath("/admin/zaracunavanje");
  return { invoiceId: result.invoiceId };
}
