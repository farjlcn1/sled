-- Vehicle billing: per-vehicle enable flag + which of the tenant's (possibly several) packages
-- this vehicle bills against.
ALTER TABLE "vehicles" ADD COLUMN "billingEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "vehicles" ADD COLUMN "subscriptionId" TEXT;
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tenant billing contact + auto-send toggle.
ALTER TABLE "tenants" ADD COLUMN "billingEmail" TEXT;
ALTER TABLE "tenants" ADD COLUMN "autoSendInvoice" BOOLEAN NOT NULL DEFAULT false;

-- Invoice (one per tenant per calendar month) + snapshot line items.
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_lines" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "deviceImei" TEXT NOT NULL,
    "vehiclePlate" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invoices_tenantId_periodYear_periodMonth_key" ON "invoices"("tenantId", "periodYear", "periodMonth");
CREATE UNIQUE INDEX "invoices_tenantId_number_key" ON "invoices"("tenantId", "number");

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
