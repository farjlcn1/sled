"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { diffFields, logAudit } from "@/lib/audit";
import { generateStrongPassword, hashPassword, passwordSchema } from "@/lib/auth/password";
import { isMailConfigured, sendMail } from "@/lib/mail";

const LEVEL_PERMISSIONS = {
  SUDO: { canManagePlatform: true, canManageUsers: true, canManageVehicles: true, canManageDrivers: true, canViewReports: true },
  UP: { canManagePlatform: false, canManageUsers: true, canManageVehicles: true, canManageDrivers: true, canViewReports: true },
  U: { canManagePlatform: false, canManageUsers: false, canManageVehicles: false, canManageDrivers: false, canViewReports: true },
  DEMO: { canManagePlatform: false, canManageUsers: false, canManageVehicles: false, canManageDrivers: false, canViewReports: false },
} as const;

const userSchema = z.object({
  email: z.string().trim().email("Vnesi veljaven email."),
  fullName: z.string().trim().min(1, "Vnesi ime uporabnika."),
  level: z.enum(["SUDO", "UP", "U", "DEMO"]),
  tenantId: z.string().optional(),
  passwordMode: z.enum(["manual", "generate"]).default("generate"),
  manualPassword: z.string().optional(),
  vehicleIds: z.array(z.string()).default([]),
  groupIds: z.array(z.string()).default([]),
});

export type UserState =
  | { error?: string; generatedPassword?: string; createdEmail?: string; emailSent?: boolean }
  | undefined;

export async function createTenantUser(_prevState: UserState, formData: FormData): Promise<UserState> {
  const admin = await requireUser();
  if (!admin.canManageUsers) {
    return { error: "Nimaš dovoljenja za ustvarjanje uporabnikov." };
  }
  const isSudo = admin.canManagePlatform && !admin.tenantId;

  const parsed = userSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    level: formData.get("level"),
    tenantId: formData.get("tenantId") || undefined,
    passwordMode: formData.get("passwordMode") || "generate",
    manualPassword: formData.get("manualPassword") || undefined,
    vehicleIds: formData.getAll("vehicleIds").map(String),
    groupIds: formData.getAll("groupIds").map(String),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neveljavni podatki." };
  }

  if (parsed.data.level === "SUDO" && !isSudo) {
    return { error: "Samo administracija lahko ustvari sudo uporabnika." };
  }

  let tenantId: string | null;
  if (parsed.data.level === "SUDO") {
    tenantId = null;
  } else if (isSudo) {
    if (!parsed.data.tenantId) return { error: "Izberi podjetje." };
    tenantId = parsed.data.tenantId;
  } else {
    if (!admin.tenantId) return { error: "Ni dovoljeno." };
    tenantId = admin.tenantId;
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (existing) {
    return { error: "Uporabnik s tem emailom že obstaja." };
  }

  let password: string;
  if (parsed.data.passwordMode === "manual") {
    const passwordCheck = passwordSchema.safeParse(parsed.data.manualPassword ?? "");
    if (!passwordCheck.success) {
      return { error: passwordCheck.error.issues[0]?.message ?? "Neveljavno geslo." };
    }
    password = passwordCheck.data;
  } else {
    password = generateStrongPassword();
  }
  const passwordHash = await hashPassword(password);

  const permissions = LEVEL_PERMISSIONS[parsed.data.level];
  // Demo uporabnik ima lahko samo posamično dodeljena vozila, nikoli cele skupine.
  const groupIds = parsed.data.level === "DEMO" ? [] : parsed.data.groupIds;

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email.toLowerCase(),
      fullName: parsed.data.fullName,
      passwordHash,
      tenantId,
      level: parsed.data.level,
      ...permissions,
      vehicleAccess: { create: parsed.data.vehicleIds.map((vehicleId) => ({ vehicleId })) },
      vehicleGroupAccess: { create: groupIds.map((groupId) => ({ groupId })) },
    },
  });

  await logAudit({
    userId: admin.id,
    userEmail: admin.email,
    tenantId: admin.tenantId,
    action: "CREATE",
    entityType: "User",
    entityId: user.id,
    entityLabel: user.email,
  });

  revalidatePath("/uporabniki");

  if (parsed.data.passwordMode === "manual") {
    return { createdEmail: user.email };
  }

  if (isMailConfigured()) {
    try {
      await sendMail({
        to: user.email,
        subject: "Dostop do aplikacije Sledenje",
        text: `Pozdravljeni ${user.fullName},\n\nVaš uporabniški račun za aplikacijo Sledenje je bil ustvarjen.\n\nEmail: ${user.email}\nGeslo: ${password}\n\nOb prvi prijavi priporočamo, da geslo spremenite.`,
      });
      return { createdEmail: user.email, emailSent: true };
    } catch {
      return { generatedPassword: password, createdEmail: user.email, emailSent: false };
    }
  }

  return { generatedPassword: password, createdEmail: user.email, emailSent: false };
}

const editUserSchema = z.object({
  userId: z.string(),
  level: z.enum(["SUDO", "UP", "U", "DEMO"]),
  newPassword: z.string().optional(),
  vehicleIds: z.array(z.string()).default([]),
  groupIds: z.array(z.string()).default([]),
});

export type EditUserState = { error?: string; success?: boolean } | undefined;

// Urejanje obstoječih uporabnikov (nivo, dostop do skupin/vozil, geslo): sudo lahko ureja vse,
// UP lahko ureja samo uporabnike znotraj lastnega podjetja in ne more podeliti sudo nivoja.
export async function updateUser(_prevState: EditUserState, formData: FormData): Promise<EditUserState> {
  const admin = await requireUser();
  const isSudo = admin.canManagePlatform && !admin.tenantId;
  if (!admin.canManageUsers) {
    return { error: "Nimaš dovoljenja za urejanje uporabnikov." };
  }

  const parsed = editUserSchema.safeParse({
    userId: formData.get("userId"),
    level: formData.get("level"),
    newPassword: formData.get("newPassword") || undefined,
    vehicleIds: formData.getAll("vehicleIds").map(String),
    groupIds: formData.getAll("groupIds").map(String),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neveljavni podatki." };
  }

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    include: { vehicleAccess: true, vehicleGroupAccess: true },
  });
  if (!target) return { error: "Uporabnik ne obstaja." };

  if (!isSudo) {
    if (target.tenantId !== admin.tenantId) {
      return { error: "Ni dovoljeno." };
    }
    if (parsed.data.level === "SUDO") {
      return { error: "Samo administracija lahko podeli sudo nivo." };
    }
  }

  let tenantId: string | null;
  if (parsed.data.level === "SUDO") {
    tenantId = null;
  } else {
    if (!target.tenantId) {
      return { error: "Uporabnik brez podjetja (sudo) ne more biti prestavljen na ta nivo tukaj — najprej mu ročno dodeli podjetje." };
    }
    tenantId = target.tenantId;
  }

  let passwordHash: string | undefined;
  if (parsed.data.newPassword) {
    const passwordCheck = passwordSchema.safeParse(parsed.data.newPassword);
    if (!passwordCheck.success) {
      return { error: passwordCheck.error.issues[0]?.message ?? "Neveljavno geslo." };
    }
    passwordHash = await hashPassword(passwordCheck.data);
  }

  const permissions = LEVEL_PERMISSIONS[parsed.data.level];
  // Sudo in demo nimata posamično/skupinsko dodeljenih vozil (sudo vidi vse, demo samo posamično).
  const vehicleIds = parsed.data.level === "SUDO" ? [] : parsed.data.vehicleIds;
  const groupIds = parsed.data.level === "SUDO" || parsed.data.level === "DEMO" ? [] : parsed.data.groupIds;

  await prisma.$transaction([
    prisma.userVehicleAccess.deleteMany({ where: { userId: target.id } }),
    prisma.userVehicleGroupAccess.deleteMany({ where: { userId: target.id } }),
    prisma.user.update({
      where: { id: target.id },
      data: {
        level: parsed.data.level,
        tenantId,
        ...permissions,
        ...(passwordHash ? { passwordHash } : {}),
        vehicleAccess: { create: vehicleIds.map((vehicleId) => ({ vehicleId })) },
        vehicleGroupAccess: { create: groupIds.map((groupId) => ({ groupId })) },
      },
    }),
  ]);

  const changes = diffFields(target, { level: parsed.data.level });
  if (target.vehicleAccess.length !== vehicleIds.length) {
    changes.vehicleIds = { from: target.vehicleAccess.length, to: vehicleIds.length };
  }
  if (target.vehicleGroupAccess.length !== groupIds.length) {
    changes.groupIds = { from: target.vehicleGroupAccess.length, to: groupIds.length };
  }

  await logAudit({
    userId: admin.id,
    userEmail: admin.email,
    tenantId: admin.tenantId,
    action: "UPDATE",
    entityType: "User",
    entityId: target.id,
    entityLabel: target.email,
    changes,
  });

  revalidatePath("/uporabniki");
  return { success: true };
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  const admin = await requireUser();
  if (!admin.canManageUsers) throw new Error("Ni dovoljeno.");

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return;

  const isSudo = admin.canManagePlatform && !admin.tenantId;
  if (!isSudo && target.tenantId !== admin.tenantId) throw new Error("Ni dovoljeno.");

  await prisma.user.update({ where: { id: userId }, data: { isActive } });

  await logAudit({
    userId: admin.id,
    userEmail: admin.email,
    tenantId: admin.tenantId,
    action: "UPDATE",
    entityType: "User",
    entityId: userId,
    entityLabel: target.email,
    changes: { isActive: { from: !isActive, to: isActive } },
  });

  revalidatePath("/uporabniki");
}
