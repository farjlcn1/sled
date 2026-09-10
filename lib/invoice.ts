import "server-only";
import { prisma } from "@/lib/db";

const MONTH_NAMES_SL = [
  "januar",
  "februar",
  "marec",
  "april",
  "maj",
  "junij",
  "julij",
  "avgust",
  "september",
  "oktober",
  "november",
  "december",
];

export function invoicePeriodLabel(year: number, month: number): string {
  return `${MONTH_NAMES_SL[month - 1]} ${year}`;
}

// Zaporedna številka znotraj podjetja, npr. "RAC-2026-0001" -- isto načelo kot nextPotniNalogNumber
// (glej lib/potni-nalog.ts): SRS 21 zahteva zaporednost, da listina velja kot verodostojna.
export async function nextInvoiceNumber(tenantId: string, year: number): Promise<string> {
  const prefix = `RAC-${year}-`;
  const count = await prisma.invoice.count({ where: { tenantId, number: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

export type GenerateInvoiceResult = { invoiceId: string; created: boolean } | { error: string };

// Ustvari (ali vrne že obstoječi, glej @@unique v schema.prisma) račun za podjetje za dano
// koledarsko obdobje. Zajame samo vozila, ki imajo HKRATI billingEnabled=true, dodeljeno napravo
// (IMEI za prikaz na računu) in dodeljen AKTIVEN paket (subscriptionId + subscription.status) --
// brez katerega koli od teh treh pogojev ni jasno kaj/po kateri ceni zaračunati, zato se izpusti.
export async function generateInvoiceForTenant(
  tenantId: string,
  year: number,
  month: number
): Promise<GenerateInvoiceResult> {
  const existing = await prisma.invoice.findUnique({
    where: { tenantId_periodYear_periodMonth: { tenantId, periodYear: year, periodMonth: month } },
  });
  if (existing) return { invoiceId: existing.id, created: false };

  const vehicles = await prisma.vehicle.findMany({
    where: { tenantId, billingEnabled: true, deviceId: { not: null }, subscription: { status: "ACTIVE" } },
    include: { device: true, subscription: { include: { plan: true } } },
  });
  const billable = vehicles.filter(
    (v): v is typeof v & { device: NonNullable<(typeof v)["device"]>; subscription: NonNullable<(typeof v)["subscription"]> } =>
      v.device !== null && v.subscription !== null
  );

  if (billable.length === 0) {
    return { error: "Ni vozil z omogočenim zaračunavanjem, napravo in dodeljenim paketom za to podjetje." };
  }

  const number = await nextInvoiceNumber(tenantId, year);
  const totalCents = billable.reduce((sum, v) => sum + v.subscription.plan.priceMonthlyCents, 0);

  const invoice = await prisma.invoice.create({
    data: {
      tenantId,
      number,
      periodYear: year,
      periodMonth: month,
      totalCents,
      lines: {
        create: billable.map((v) => ({
          deviceImei: v.device.imei,
          vehiclePlate: v.plate,
          planName: v.subscription.plan.name,
          priceCents: v.subscription.plan.priceMonthlyCents,
        })),
      },
    },
    select: { id: true },
  });

  return { invoiceId: invoice.id, created: true };
}
