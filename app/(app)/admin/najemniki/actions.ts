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
  deviceLimit: z.coerce.number().int().min(1).max(500).default(500),
});

export type TenantState = { error?: string } | undefined;

export async function createTenant(_prevState: TenantState, formData: FormData): Promise<TenantState> {
  const user = await requirePlatformAdmin();

  const parsed = tenantSchema.safeParse({
    name: formData.get("name"),
    deviceLimit: formData.get("deviceLimit") || 500,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neveljavni podatki." };
  }

  // "Arhiv" je sistemska skupina -- vanjo pade vozilo, ko se z njega odveže sledilna naprava
  // (glej archiveVehicle v app/(app)/vozila/actions.ts), zato jo mora imeti vsak najemnik od
  // samega začetka, ne šele ob prvi arhivirani napravi.
  const tenant = await prisma.tenant.create({
    data: { ...parsed.data, vehicleGroups: { create: { name: "Arhiv", isArchiveGroup: true } } },
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

// Ureja osnovne podatke + status podjetja in obenem uskladi njegove pakete (glej planIds spodaj)
// -- podjetje ima lahko več paketov hkrati (npr. en za osebna vozila, drug za kamione), zato je to
// zdaj množica odkljukanih paketov, ne en sam izbirnik kot prej.
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
    deviceLimit: formData.get("deviceLimit") || 500,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neveljavni podatki." };
  }

  const statusRaw = formData.get("status");
  const status: TenantStatus = (TENANT_STATUS_VALUES as readonly string[]).includes(statusRaw as string)
    ? (statusRaw as TenantStatus)
    : existing.status;

  const planIds = formData.getAll("planIds").map(String).filter(Boolean);

  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({ where: { id: tenantId }, data: { ...parsed.data, status } });

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
    changes: diffFields(existing, { ...parsed.data, status }),
  });

  revalidatePath("/admin/najemniki");
  return { success: true };
}
