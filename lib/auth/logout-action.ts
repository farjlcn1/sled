"use server";

import { redirect } from "next/navigation";
import { destroySession, getSession } from "./session";
import { logAudit } from "@/lib/audit";

export async function logout() {
  const user = await getSession();
  if (user) {
    await logAudit({
      userId: user.id,
      userEmail: user.email,
      tenantId: user.tenantId,
      action: "LOGOUT",
      entityType: "Session",
      entityLabel: user.fullName,
    });
  }
  await destroySession();
  redirect("/login");
}
