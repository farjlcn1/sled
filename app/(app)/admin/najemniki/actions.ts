"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/session";

const tenantSchema = z.object({
  name: z.string().min(1, "Vnesi ime podjetja."),
  deviceLimit: z.coerce.number().int().min(1).max(500).default(500),
});

export type TenantState = { error?: string } | undefined;

export async function createTenant(_prevState: TenantState, formData: FormData): Promise<TenantState> {
  await requirePlatformAdmin();

  const parsed = tenantSchema.safeParse({
    name: formData.get("name"),
    deviceLimit: formData.get("deviceLimit") || 500,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neveljavni podatki." };
  }

  await prisma.tenant.create({ data: parsed.data });
  revalidatePath("/admin/najemniki");
}

export async function toggleTenantActive(id: string, isActive: boolean) {
  await requirePlatformAdmin();
  await prisma.tenant.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/najemniki");
}
