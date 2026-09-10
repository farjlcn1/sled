"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/session";

const planSchema = z.object({
  name: z.string().trim().min(1, "Vnesi ime paketa."),
  priceMonthly: z.coerce.number().min(0, "Cena ne more biti negativna."),
  description: z.string().optional(),
});

export type PlanState = { error?: string } | undefined;

export async function createPlan(_prevState: PlanState, formData: FormData): Promise<PlanState> {
  await requirePlatformAdmin();

  const parsed = planSchema.safeParse({
    name: formData.get("name"),
    priceMonthly: formData.get("priceMonthly"),
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
