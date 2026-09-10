"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { diffFields, logAudit } from "@/lib/audit";
import { generateInvoiceForTenant } from "@/lib/invoice";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { sendMail, isMailConfigured } from "@/lib/mail";

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

export type SendInvoiceResult = { error?: string; success?: string };

// Ročno "Pošlji" -- neodvisno od Tenant.autoSendInvoice (ta ureja samo mesečni samodejni tek, glej
// scripts/monthly-billing.ts). Naslovi se berejo IZ PODATKOV PODJETJA (zavihek Podjetja), tu se
// jih ne more urejati. Če je tekoči mesec že poslan, se ne poskuša znova generirati (bilo bi
// zavrnjeno, glej generateInvoiceForTenant) -- samo znova pošlje že obstoječega.
export async function sendCurrentInvoice(tenantId: string): Promise<SendInvoiceResult> {
  const user = await requirePlatformAdmin();
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return { error: "Podjetje ne obstaja." };
  if (tenant.billingEmails.length === 0) {
    return { error: "Za to podjetje ni nastavljenega e-poštnega naslova (uredi v zavihku Podjetja)." };
  }
  if (!isMailConfigured()) return { error: "SMTP ni nastavljen." };

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const result = await generateInvoiceForTenant(tenantId, year, month);
  let invoiceId: string;
  if ("error" in result) {
    const existing = await prisma.invoice.findUnique({
      where: { tenantId_periodYear_periodMonth: { tenantId, periodYear: year, periodMonth: month } },
    });
    if (!existing) return { error: result.error };
    invoiceId = existing.id;
  } else {
    invoiceId = result.invoiceId;
  }

  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { number: true } });
  const pdf = await generateInvoicePdf(invoiceId);
  await sendMail({
    to: tenant.billingEmails.join(", "),
    subject: `Račun ${invoice.number} -- ${tenant.name}`,
    text: "V prilogi je mesečni račun za storitev sledenja vozil.",
    attachments: [{ filename: `racun-${invoice.number}.pdf`, content: pdf }],
  });
  await prisma.invoice.update({ where: { id: invoiceId }, data: { sentAt: new Date() } });

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    tenantId,
    action: "UPDATE",
    entityType: "Invoice",
    entityId: invoiceId,
    entityLabel: `Račun poslan na ${tenant.billingEmails.join(", ")}`,
  });

  revalidatePath("/admin/zaracunavanje");
  return { success: `Poslano na: ${tenant.billingEmails.join(", ")}` };
}
