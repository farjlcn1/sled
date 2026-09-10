import type { Prisma, TenantStatus } from "@/generated/prisma/client";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AddTenantForm } from "./add-tenant-form";
import { TenantsTable, type TenantRow } from "./tenants-table";

const TENANT_STATUS_VALUES = ["AKTIVEN", "NEAKTIVEN", "TEST", "V_ODPOVEDI"] as const;

const STATUS_OPTIONS = [
  { value: "AKTIVEN", label: "Aktiven" },
  { value: "NEAKTIVEN", label: "Neaktiven" },
  { value: "TEST", label: "Test" },
  { value: "V_ODPOVEDI", label: "V odpovedi" },
];

export default async function NajemnikiPage({
  searchParams,
}: {
  searchParams: Promise<{ ime?: string; paket?: string; status?: string }>;
}) {
  await requirePlatformAdmin();
  const filters = await searchParams;

  const where: Prisma.TenantWhereInput = {};
  if (filters.ime) where.name = { contains: filters.ime, mode: "insensitive" };
  if (filters.paket) where.subscriptions = { some: { planId: filters.paket, status: "ACTIVE" } };
  if ((TENANT_STATUS_VALUES as readonly string[]).includes(filters.status ?? "")) {
    where.status = filters.status as TenantStatus;
  }

  const [tenants, plans] = await Promise.all([
    prisma.tenant.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count: { select: { vehicles: true, devices: true, users: true } },
        subscriptions: { where: { status: "ACTIVE" }, include: { plan: true } },
      },
    }),
    prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { priceMonthlyCents: "asc" }, select: { id: true, name: true } }),
  ]);

  const tenantRows: TenantRow[] = tenants.map((t) => ({
    id: t.id,
    name: t.name,
    deviceLimit: t.deviceLimit,
    status: t.status,
    planIds: t.subscriptions.map((s) => s.planId),
    planNames: t.subscriptions.map((s) => s.plan.name),
    vehicleCount: t._count.vehicles,
    deviceCount: t._count.devices,
    userCount: t._count.users,
  }));

  const selectClass =
    "mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";

  return (
    <div className="space-y-6">
      <AddTenantForm />

      <form method="get" className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:grid-cols-3">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Ime
          <input name="ime" defaultValue={filters.ime} placeholder="ime podjetja" className={`w-full ${selectClass}`} />
        </label>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Paket
          <select name="paket" defaultValue={filters.paket ?? ""} className={`w-full ${selectClass}`}>
            <option value="">vse</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Status
          <select name="status" defaultValue={filters.status ?? ""} className={`w-full ${selectClass}`}>
            <option value="">vse</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div className="col-span-2 flex items-end gap-2 sm:col-span-3">
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            Filtriraj
          </button>
          <a href="/admin/najemniki" className="text-sm text-gray-500 underline dark:text-gray-400">
            Počisti filtre
          </a>
        </div>
      </form>

      <div className="flex justify-end">
        <a
          href="/api/najemniki/izvoz"
          className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          Izvoz
        </a>
      </div>

      <TenantsTable tenants={tenantRows} plans={plans} />
    </div>
  );
}
