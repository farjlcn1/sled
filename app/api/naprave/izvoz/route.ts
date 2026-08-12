import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const PROTOCOL_LABELS: Record<string, string> = {
  TELTONIKA: "Teltonika",
  OTHER: "Drugo",
};

export async function GET() {
  await requirePlatformAdmin();

  const devices = await prisma.device.findMany({
    orderBy: { createdAt: "desc" },
    include: { tenant: true, vehicle: true },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Naprave");

  sheet.addRow([
    "IMEI",
    "Znamka",
    "Model",
    "Serijska št.",
    "SIM",
    "Protokol",
    "Podjetje",
    "Vozilo",
    "Letnik vozila",
    "Opomba",
  ]).font = { bold: true };

  for (const d of devices) {
    sheet.addRow([
      d.imei,
      d.brand ?? "",
      d.model ?? "",
      d.serialNumber ?? "",
      d.simNumber ?? "",
      PROTOCOL_LABELS[d.protocol] ?? d.protocol,
      d.tenant?.name ?? "",
      d.vehicle?.plate ?? "",
      d.vehicle?.year ?? "",
      d.note ?? "",
    ]);
  }

  sheet.columns.forEach((col) => {
    col.width = 20;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const downloadName = `naprave-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${downloadName}"`,
    },
  });
}
