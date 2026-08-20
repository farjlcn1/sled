"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";
import { checkLoginRateLimit, recordLoginFailure, recordLoginSuccess } from "@/lib/auth/rate-limit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginState = { error?: string } | undefined;

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Vnesi veljaven email in geslo." };
  }

  const rememberMe = formData.get("rememberMe") === "on";
  const redirectTo = formData.get("redirectTo");
  const email = parsed.data.email.toLowerCase();

  const rateLimit = checkLoginRateLimit(email);
  if (rateLimit.blocked) {
    await logAudit({
      userEmail: email,
      action: "LOGIN_FAILED",
      entityType: "Session",
      entityLabel: "Zaklenjeno zaradi prevečkrat neuspelih poskusov",
    });
    return { error: rateLimit.message };
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.isActive) {
    recordLoginFailure(email);
    await logAudit({
      userEmail: email,
      action: "LOGIN_FAILED",
      entityType: "Session",
      entityLabel: "Napačen email ali neaktiven uporabnik",
    });
    return { error: "Napačen email ali geslo." };
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    recordLoginFailure(email);
    await logAudit({
      userId: user.id,
      userEmail: user.email,
      tenantId: user.tenantId,
      action: "LOGIN_FAILED",
      entityType: "Session",
      entityLabel: "Napačno geslo",
    });
    return { error: "Napačen email ali geslo." };
  }

  recordLoginSuccess(email);
  await createSession(user.id, rememberMe);
  await logAudit({
    userId: user.id,
    userEmail: user.email,
    tenantId: user.tenantId,
    action: "LOGIN",
    entityType: "Session",
    entityLabel: user.fullName,
  });
  redirect(typeof redirectTo === "string" && redirectTo ? redirectTo : "/");
}
