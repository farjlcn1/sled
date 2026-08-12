import { requirePlatformAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { AuditLogTable, ACTION_LABELS, ENTITY_LABELS, type AuditLogRow } from "./audit-log-table";

function formatChangesSummary(changesJson: string | null): string | null {
  if (!changesJson) return null;
  try {
    const changes = JSON.parse(changesJson) as Record<string, { from: unknown; to: unknown }>;
    const parts = Object.entries(changes).map(([field, { from, to }]) => `${field}: ${String(from ?? "—")} → ${String(to ?? "—")}`);
    return parts.join(", ");
  } catch {
    return changesJson;
  }
}

export default async function RevizijskaSledPage({
  searchParams,
}: {
  searchParams: Promise<{ userEmail?: string; action?: string; entityType?: string; from?: string; to?: string }>;
}) {
  await requirePlatformAdmin();
  const filters = await searchParams;

  const where: Prisma.AuditLogWhereInput = {};
  if (filters.userEmail) where.userEmail = { contains: filters.userEmail, mode: "insensitive" };
  if (filters.action) where.action = filters.action as Prisma.AuditLogWhereInput["action"];
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = new Date(filters.from);
    if (filters.to) {
      const to = new Date(filters.to);
      to.setHours(23, 59, 59, 999);
      where.createdAt.lte = to;
    }
  }

  const events = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const rows: AuditLogRow[] = events.map((e) => ({
    id: e.id,
    createdAt: e.createdAt.toISOString(),
    userEmail: e.userEmail,
    action: e.action,
    entityType: e.entityType,
    entityLabel: e.entityLabel,
    changesSummary: formatChangesSummary(e.changesJson),
  }));

  const selectClass =
    "mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Revizijska sled</h1>

      <form method="get" className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:grid-cols-5">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Uporabnik
          <input name="userEmail" defaultValue={filters.userEmail} placeholder="email" className={`w-full ${selectClass}`} />
        </label>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Akcija
          <select name="action" defaultValue={filters.action ?? ""} className={`w-full ${selectClass}`}>
            <option value="">vse</option>
            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Vrsta
          <select name="entityType" defaultValue={filters.entityType ?? ""} className={`w-full ${selectClass}`}>
            <option value="">vse</option>
            {Object.entries(ENTITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Od
          <input type="date" name="from" defaultValue={filters.from} className={`w-full ${selectClass}`} />
        </label>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Do
          <input type="date" name="to" defaultValue={filters.to} className={`w-full ${selectClass}`} />
        </label>
        <div className="col-span-2 flex items-end gap-2 sm:col-span-5">
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            Filtriraj
          </button>
          <a href="/revizijska-sled" className="text-sm text-gray-500 underline dark:text-gray-400">
            Počisti filtre
          </a>
        </div>
      </form>

      <AuditLogTable rows={rows} />
    </div>
  );
}
