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

export type GenerateInvoiceResult = { invoiceId: string; status: "created" | "regenerated" } | { error: string };

async function computeBillableLines(tenantId: string) {
  const vehicles = await prisma.vehicle.findMany({
    where: { tenantId, billingEnabled: true, deviceId: { not: null }, subscription: { status: "ACTIVE" } },
    include: { device: true, subscription: { include: { plan: true } } },
  });
  const billable = vehicles.filter(
    (v): v is typeof v & { device: NonNullable<(typeof v)["device"]>; subscription: NonNullable<(typeof v)["subscription"]> } =>
      v.device !== null && v.subscription !== null
  );
  return billable.map((v) => ({
    deviceImei: v.device.imei,
    vehiclePlate: v.plate,
    planName: v.subscription.plan.name,
    priceCents: v.subscription.plan.priceMonthlyCents,
  }));
}

// Ustvari račun za podjetje za dano koledarsko obdobje, oz. če tak račun (glej @@unique v
// schema.prisma) že obstaja IN ŠE NI BIL POSLAN, ga PONOVNO IZRAČUNA (zbriše stare postavke,
// prepiše z aktualnim stanjem zaračunljivih vozil) -- brez tega bi sprememba zaračunavanja/paketa
// po prvem generiranju v istem mesecu ostala na računu neopažena. Ko je račun enkrat poslan
// (sentAt), postane nespremenljiva knjigovodska listina in se ne more več prepisati.
// Zajame samo vozila, ki imajo HKRATI billingEnabled=true, dodeljeno napravo (IMEI za prikaz na
// računu) in dodeljen AKTIVEN paket (subscriptionId + subscription.status) -- brez katerega koli
// od teh treh pogojev ni jasno kaj/po kateri ceni zaračunati, zato se izpusti.
export async function generateInvoiceForTenant(
  tenantId: string,
  year: number,
  month: number
): Promise<GenerateInvoiceResult> {
  const existing = await prisma.invoice.findUnique({
    where: { tenantId_periodYear_periodMonth: { tenantId, periodYear: year, periodMonth: month } },
  });

  if (existing?.sentAt) {
    return { error: "Račun za to obdobje je bil že poslan po e-pošti in ga ni več mogoče spremeniti." };
  }

  const lines = await computeBillableLines(tenantId);
  if (lines.length === 0) {
    return { error: "Ni vozil z omogočenim zaračunavanjem, napravo in dodeljenim paketom za to podjetje." };
  }
  const totalCents = lines.reduce((sum, l) => sum + l.priceCents, 0);

  if (existing) {
    await prisma.$transaction([
      prisma.invoiceLine.deleteMany({ where: { invoiceId: existing.id } }),
      prisma.invoice.update({ where: { id: existing.id }, data: { totalCents, lines: { create: lines } } }),
    ]);
    return { invoiceId: existing.id, status: "regenerated" };
  }

  const number = await nextInvoiceNumber(tenantId, year);
  const invoice = await prisma.invoice.create({
    data: { tenantId, number, periodYear: year, periodMonth: month, totalCents, lines: { create: lines } },
    select: { id: true },
  });

  return { invoiceId: invoice.id, status: "created" };
}
