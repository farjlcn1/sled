import { requirePlatformAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { invoicePeriodLabel } from "@/lib/invoice";
import { BillingSettingsForm } from "./billing-settings-form";
import { VehiclesBillingTable, type BillableVehicleRow } from "./vehicles-billing-table";
import { InvoicesSection, type InvoiceRow } from "./invoices-section";

export default async function ZaracunavanjePage({
  searchParams,
}: {
  searchParams: Promise<{ podjetje?: string }>;
}) {
  await requirePlatformAdmin();
  const { podjetje } = await searchParams;

  const tenants = await prisma.tenant.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const tenantId = podjetje || undefined;

  let tenant: {
    id: string;
    name: string;
    billingEmail: string | null;
    autoSendInvoice: boolean;
    billingAddress: string | null;
    taxId: string | null;
  } | null = null;
  let vehicleRows: BillableVehicleRow[] = [];
  let plans: { id: string; name: string }[] = [];
  let invoiceRows: InvoiceRow[] = [];

  if (tenantId) {
    const [tenantData, vehicles, subscriptions, invoices] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          billingEmail: true,
          autoSendInvoice: true,
          billingAddress: true,
          taxId: true,
        },
      }),
      prisma.vehicle.findMany({
        where: { tenantId },
        orderBy: { plate: "asc" },
        include: { device: { select: { imei: true } } },
      }),
      prisma.subscription.findMany({
        where: { tenantId, status: "ACTIVE" },
        include: { plan: { select: { name: true } } },
      }),
      prisma.invoice.findMany({
        where: { tenantId },
        orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
      }),
    ]);

    tenant = tenantData;
    plans = subscriptions.map((s) => ({ id: s.id, name: s.plan.name }));
    vehicleRows = vehicles.map((v) => ({
      id: v.id,
      plate: v.plate,
      deviceImei: v.device?.imei ?? null,
      subscriptionId: v.subscriptionId,
      billingEnabled: v.billingEnabled,
    }));
    invoiceRows = invoices.map((inv) => ({
      id: inv.id,
      number: inv.number,
      periodLabel: invoicePeriodLabel(inv.periodYear, inv.periodMonth),
      totalCents: inv.totalCents,
      sentAt: inv.sentAt ? inv.sentAt.toISOString() : null,
    }));
  }

  const now = new Date();
  const currentPeriodLabel = invoicePeriodLabel(now.getFullYear(), now.getMonth() + 1);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Zaračunavanje</h1>

      <form className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Podjetje</label>
          <select
            name="podjetje"
            defaultValue={tenantId ?? ""}
            className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="" disabled>
              — izberi podjetje —
            </option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
          Prikaži
        </button>
      </form>

      {!tenantId && <p className="text-sm text-gray-500 dark:text-gray-400">Izberi podjetje za upravljanje zaračunavanja.</p>}

      {tenant && (
        <div className="space-y-6">
          <BillingSettingsForm tenant={tenant} />
          <VehiclesBillingTable key={tenant.id} tenantId={tenant.id} vehicles={vehicleRows} plans={plans} />
          <InvoicesSection tenantId={tenant.id} currentPeriodLabel={currentPeriodLabel} invoices={invoiceRows} />
        </div>
      )}
    </div>
  );
}
