import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function GET() {
  await requirePlatformAdmin();

  const tenants = await prisma.tenant.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { vehicles: true, devices: true, users: true } },
      subscription: { include: { plan: true } },
    },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Podjetja");

  sheet.addRow(["Ime", "Paket", "Meja naprav", "Št. vozil", "Št. naprav", "Št. uporabnikov", "Status"]).font = {
    bold: true,
  };
  for (const t of tenants) {
    const planName = t.subscription?.status === "ACTIVE" ? t.subscription.plan.name : "";
    sheet.addRow([
      t.name,
      planName,
      t.deviceLimit,
      t._count.vehicles,
      t._count.devices,
      t._count.users,
      t.isActive ? "Aktivna" : "Neaktivna",
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
