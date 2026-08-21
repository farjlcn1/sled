import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import type { UserLevel } from "@/generated/prisma/client";

const SESSION_COOKIE = "sledenje_session";
const REMEMBER_ME_MAX_AGE = 60 * 60 * 24 * 30; // 30 dni
const DEFAULT_MAX_AGE = 60 * 60 * 12; // 12 ur

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET ni nastavljen");
  return new TextEncoder().encode(secret);
}

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  tenantId: string | null;
  level: UserLevel;
  canManagePlatform: boolean;
  canManageUsers: boolean;
  canManageVehicles: boolean;
  canManageDrivers: boolean;
  canViewReports: boolean;
  visibleVehicleFields: string[];
  visibleTabs: string[];
};

export async function createSession(userId: string, rememberMe: boolean) {
  const maxAge = rememberMe ? REMEMBER_ME_MAX_AGE : DEFAULT_MAX_AGE;
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAge)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

async function getUserIdFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return typeof payload.userId === "string" ? payload.userId : null;
  } catch {
    return null;
  }
}

// Pravice se vedno berejo sveže iz baze (ne iz JWT), da odvzem pravic velja takoj.
export async function getSession(): Promise<CurrentUser | null> {
  const userId = await getUserIdFromCookie();
  if (!userId) return null;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    tenantId: user.tenantId,
    level: user.level,
    canManagePlatform: user.canManagePlatform,
    canManageUsers: user.canManageUsers,
    canManageVehicles: user.canManageVehicles,
    canManageDrivers: user.canManageDrivers,
    canViewReports: user.canViewReports,
    visibleVehicleFields: user.visibleVehicleFields,
    visibleTabs: user.visibleTabs,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

export async function requirePermission(
  permission: keyof Omit<CurrentUser, "id" | "email" | "fullName" | "tenantId" | "level" | "visibleVehicleFields" | "visibleTabs">
): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user[permission]) redirect("/");
  return user;
}

// Administracija (naše osebje) nima tenantId — vidi vsa podjetja/naprave.
export async function requirePlatformAdmin(): Promise<CurrentUser> {
  return requirePermission("canManagePlatform");
}
