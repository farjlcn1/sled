"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { diffFields, logAudit } from "@/lib/audit";
import type { TenantStatus } from "@/generated/prisma/client";

const TENANT_STATUS_VALUES = ["AKTIVEN", "NEAKTIVEN", "TEST", "V_ODPOVEDI"] as const;

const tenantSchema = z.object({
  name: z.string().min(1, "Vnesi ime podjetja."),
  billingAddress: z.string().trim().optional(),
  taxId: z.string().trim().optional(),
  contactPerson: z.string().trim().optional(),
  contactPhone: z.string().trim().optional(),
});

const emailSchema = z.string().trim().email();

// Eden na vrstico (ali ločeni z vejico) -- podjetje lahko prejema račune na več naslovov hkrati
// (npr. računovodstvo + lastnik), glej Tenant.billingEmails.
function parseEmailList(raw: string): string[] | { error: string } {
  const emails = raw
    .split(/[\n,]/)
    .map((e) => e.trim())
    .filter(Boolean);
  for (const e of emails) {
    if (!emailSchema.safeParse(e).success) return { error: `"${e}" ni veljaven e-poštni naslov.` };
  }
  return emails;
}

export type TenantState = { error?: string } | undefined;

export async function createTenant(_prevState: TenantState, formData: FormData): Promise<TenantState> {
  const user = await requirePlatformAdmin();

  const parsed = tenantSchema.safeParse({
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neveljavni podatki." };
  }

  // "Arhiv" je sistemska skupina -- vanjo pade vozilo, ko se z njega odveže sledilna naprava
  // (glej archiveVehicle v app/(app)/vozila/actions.ts), zato jo mora imeti vsak najemnik od
  // samega začetka, ne šele ob prvi arhivirani napravi.
  const tenant = await prisma.tenant.create({
    data: { name: parsed.data.name, deviceLimit: 500, vehicleGroups: { create: { name: "Arhiv", isArchiveGroup: true } } },
  });

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    tenantId: null,
    action: "CREATE",
    entityType: "Tenant",
    entityId: tenant.id,
    entityLabel: tenant.name,
  });

  revalidatePath("/admin/najemniki");
}

export type UpdateTenantState = { error?: string; success?: boolean } | undefined;

// Ureja osnovne, kontaktne in obračunske podatke podjetja (glej opombo ob teh poljih v
// schema.prisma) in obenem uskladi njegove pakete (glej planIds spodaj) -- podjetje ima lahko več
// paketov hkrati (npr. en za osebna vozila, drug za kamione), zato je to zdaj množica odkljukanih
// paketov, ne en sam izbirnik kot prej.
export async function updateTenant(
  tenantId: string,
  _prevState: UpdateTenantState,
  formData: FormData
): Promise<UpdateTenantState> {
  const user = await requirePlatformAdmin();

  const existing = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!existing) return { error: "Podjetje ne obstaja." };

  const parsed = tenantSchema.safeParse({
    name: formData.get("name"),
    billingAddress: formData.get("billingAddress") || undefined,
    taxId: formData.get("taxId") || undefined,
    contactPerson: formData.get("contactPerson") || undefined,
    contactPhone: formData.get("contactPhone") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neveljavni podatki." };
  }

  const billingEmailsResult = parseEmailList(String(formData.get("billingEmails") ?? ""));
  if ("error" in billingEmailsResult) return { error: billingEmailsResult.error };

  const autoSendInvoice = formData.get("autoSendInvoice") === "on";
  if (autoSendInvoice && billingEmailsResult.length === 0) {
    return { error: "Za samodejno pošiljanje po e-pošti je potreben vsaj en e-poštni naslov." };
  }

  const statusRaw = formData.get("status");
  const status: TenantStatus = (TENANT_STATUS_VALUES as readonly string[]).includes(statusRaw as string)
    ? (statusRaw as TenantStatus)
    : existing.status;

  const planIds = formData.getAll("planIds").map(String).filter(Boolean);

  const data = {
    name: parsed.data.name,
    billingAddress: parsed.data.billingAddress || null,
    taxId: parsed.data.taxId || null,
    contactPerson: parsed.data.contactPerson || null,
    contactPhone: parsed.data.contactPhone || null,
    billingEmails: billingEmailsResult,
    autoSendInvoice,
    status,
  };

  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({ where: { id: tenantId }, data });

    const currentActive = await tx.subscription.findMany({
      where: { tenantId, status: "ACTIVE" },
      select: { planId: true },
    });
    const currentPlanIds = new Set(currentActive.map((s) => s.planId));
    const nextPlanIds = new Set(planIds);

    const toAdd = planIds.filter((id) => !currentPlanIds.has(id));
    const toRemove = Array.from(currentPlanIds).filter((id) => !nextPlanIds.has(id));

    for (const planId of toAdd) {
      await tx.subscription.upsert({
        where: { tenantId_planId: { tenantId, planId } },
        create: { tenantId, planId, status: "ACTIVE" },
        update: { status: "ACTIVE", canceledAt: null },
      });
    }
    if (toRemove.length > 0) {
      await tx.subscription.updateMany({
        where: { tenantId, planId: { in: toRemove } },
        data: { status: "CANCELED", canceledAt: new Date() },
      });
    }
  });

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    action: "UPDATE",
    entityType: "Tenant",
    entityId: tenantId,
    entityLabel: existing.name,
    changes: diffFields(existing, data),
  });

  revalidatePath("/admin/najemniki");
  revalidatePath("/admin/zaracunavanje");
  return { success: true };
}
