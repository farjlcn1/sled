"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/session";

const planSchema = z.object({
  name: z.string().trim().min(1, "Vnesi ime paketa."),
  priceMonthly: z.coerce.number().min(0, "Cena ne more biti negativna."),
  deviceLimit: z.coerce.number().int().min(1).max(500),
  description: z.string().optional(),
});

export type PlanState = { error?: string } | undefined;

export async function createPlan(_prevState: PlanState, formData: FormData): Promise<PlanState> {
  await requirePlatformAdmin();

  const parsed = planSchema.safeParse({
    name: formData.get("name"),
    priceMonthly: formData.get("priceMonthly"),
    deviceLimit: formData.get("deviceLimit"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neveljavni podatki." };
  }

  try {
    await prisma.subscriptionPlan.create({
      data: {
        name: parsed.data.name,
        priceMonthlyCents: Math.round(parsed.data.priceMonthly * 100),
        deviceLimit: parsed.data.deviceLimit,
        description: parsed.data.description,
      },
    });
  } catch {
    return { error: "Paket s tem imenom že obstaja." };
  }

  revalidatePath("/admin/paketi");
  revalidatePath("/admin/najemniki");
}

export async function togglePlanActive(id: string, isActive: boolean) {
  await requirePlatformAdmin();
  await prisma.subscriptionPlan.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/paketi");
  revalidatePath("/admin/najemniki");
}

export async function assignPlanToTenant(tenantId: string, planId: string) {
  await requirePlatformAdmin();

  if (!planId) {
    await prisma.subscription.updateMany({
      where: { tenantId, status: "ACTIVE" },
      data: { status: "CANCELED", canceledAt: new Date() },
    });
    revalidatePath("/admin/najemniki");
    return;
  }

  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Paket ne obstaja.");

  const currentDeviceCount = await prisma.device.count({ where: { tenantId } });
  if (currentDeviceCount > plan.deviceLimit) {
    throw new Error(
      `Podjetje ima trenutno ${currentDeviceCount} naprav, izbrani paket pa dovoljuje le ${plan.deviceLimit}.`
    );
  }

  await prisma.$transaction([
    prisma.subscription.upsert({
      where: { tenantId },
      create: { tenantId, planId, status: "ACTIVE" },
      update: { planId, status: "ACTIVE", canceledAt: null },
    }),
    prisma.tenant.update({ where: { id: tenantId }, data: { deviceLimit: plan.deviceLimit } }),
  ]);

  revalidatePath("/admin/najemniki");
}
