import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const ID_METHOD_LABELS: Record<string, string> = {
  RFID_1356MHZ: "RFID 13,56 MHz",
  RFID_125KHZ: "RFID 125 kHz",
  IBUTTON: "iButton",
};

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Ni dovoljeno." }, { status: 403 });

  const drivers = await prisma.driver.findMany({
    where: user.canManagePlatform ? {} : { tenantId: user.tenantId ?? "" },
    orderBy: { fullName: "asc" },
    include: { currentVehicles: { select: { plate: true }, take: 1 }, tenant: true },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Vozniki");

  sheet.addRow([
    "Ime in priimek",
    "Podjetje",
    "Telefon",
    "Način ID",
    "ID koda",
    "Trenutno vozilo",
  ]).font = { bold: true };

  for (const d of drivers) {
    sheet.addRow([
      d.fullName,
      d.tenant.name,
      d.phone ?? "",
      ID_METHOD_LABELS[d.idMethod] ?? d.idMethod,
      d.idCode ?? "",
      d.currentVehicles[0]?.plate ?? "",
    ]);
  }

  sheet.columns.forEach((col) => {
    col.width = 20;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const downloadName = `vozniki-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${downloadName}"`,
    },
  });
}
