"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { diffFields, logAudit } from "@/lib/audit";

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

  const tenant = await prisma.tenant.create({ data: parsed.data });

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

  await prisma.tenant.update({ where: { id: tenantId }, data: parsed.data });

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    action: "UPDATE",
    entityType: "Tenant",
    entityId: tenantId,
    entityLabel: existing.name,
    changes: diffFields(existing, parsed.data),
  });

  revalidatePath("/admin/najemniki");
  return { success: true };
}

export async function toggleTenantActive(id: string, isActive: boolean) {
  const user = await requirePlatformAdmin();
  const tenant = await prisma.tenant.update({ where: { id }, data: { isActive } });

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    action: "UPDATE",
    entityType: "Tenant",
    entityId: id,
    entityLabel: tenant.name,
    changes: { isActive: { from: !isActive, to: isActive } },
  });

  revalidatePath("/admin/najemniki");
}
