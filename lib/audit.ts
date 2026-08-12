import "server-only";
import { prisma } from "@/lib/db";
import type { AuditAction } from "@/generated/prisma/client";

export type AuditChange = { from: unknown; to: unknown };

// Beleženje je stranski učinek — napaka pri pisanju revizijske sledi ne sme podreti glavne akcije.
export async function logAudit(params: {
  userId?: string | null;
  userEmail: string;
  tenantId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  changes?: Record<string, AuditChange>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        userEmail: params.userEmail,
        tenantId: params.tenantId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        entityLabel: params.entityLabel ?? null,
        changesJson: params.changes ? JSON.stringify(params.changes) : null,
      },
    });
  } catch (err) {
    console.error("logAudit failed:", err);
  }
}

// Primerja dva objekta polje-za-polje in vrne samo tista, ki se razlikujejo — za changesJson pri UPDATE.
export function diffFields<T extends Record<string, unknown>>(before: T, after: Partial<T>): Record<string, AuditChange> {
  const changes: Record<string, AuditChange> = {};
  for (const key of Object.keys(after) as (keyof T)[]) {
    if (after[key] !== undefined && before[key] !== after[key]) {
      changes[key as string] = { from: before[key], to: after[key] };
    }
  }
  return changes;
}
