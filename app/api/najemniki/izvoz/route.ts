import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const STATUS_LABELS: Record<string, string> = {
  AKTIVEN: "Aktiven",
  NEAKTIVEN: "Neaktiven",
  TEST: "Test",
  V_ODPOVEDI: "V odpovedi",
};

export async function GET() {
  await requirePlatformAdmin();

  const tenants = await prisma.tenant.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { vehicles: true, devices: true, users: true } },
      subscriptions: { where: { status: "ACTIVE" }, include: { plan: true } },
    },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Podjetja");

  sheet.addRow([
    "Ime",
    "Paketi",
    "Cena/mesec (€)",
    "Št. vozil",
    "Št. naprav",
    "Št. uporabnikov",
    "Status",
    "Naslov",
    "Davčna št.",
    "Kontaktna oseba",
    "Telefon",
    "E-pošta",
  ]).font = { bold: true };
  for (const t of tenants) {
    const planNames = t.subscriptions.map((s) => s.plan.name).join(", ");
    const priceMonthly = t.subscriptions.reduce((sum, s) => sum + s.plan.priceMonthlyCents, 0) / 100;
    sheet.addRow([
      t.name,
      planNames,
      priceMonthly,
      t._count.vehicles,
      t._count.devices,
      t._count.users,
      STATUS_LABELS[t.status] ?? t.status,
      t.billingAddress ?? "",
      t.taxId ?? "",
      t.contactPerson ?? "",
      t.contactPhone ?? "",
      t.billingEmails.join(", "),
    ]);
  }
  sheet.columns.forEach((col) => {
    col.width = 20;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="podjetja.xlsx"`,
    },
  });
}
