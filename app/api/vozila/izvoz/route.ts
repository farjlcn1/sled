import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const user = await getSession();
  if (!user || (!user.canManageVehicles && !user.canManagePlatform)) {
    return NextResponse.json({ error: "Ni dovoljeno." }, { status: 403 });
  }

  const url = new URL(req.url);
  let tenantId = user.tenantId ?? undefined;
  if (user.canManagePlatform && !user.tenantId) {
    tenantId = url.searchParams.get("podjetje") ?? undefined;
  }
  if (!tenantId) {
    return NextResponse.json({ error: "Manjka podjetje." }, { status: 400 });
  }

  const vehicles = await prisma.vehicle.findMany({
    where: { tenantId },
    orderBy: { plate: "asc" },
    include: { currentDriver: true, device: true },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Vozila");

  sheet.addRow([
    "Registrska",
    "Znamka",
    "Model",
    "Letnik",
    "Naprava (IMEI)",
    "Datum registracije",
    "Naslednji servis",
    "Naslednji servis (km)",
    "Volumen rezervoarja (L)",
    "Voznik",
    "Opomba",
  ]).font = { bold: true };

  for (const v of vehicles) {
    sheet.addRow([
      v.plate,
      v.brand ?? "",
      v.model ?? "",
      v.year ?? "",
      v.device?.imei ?? "",
      v.registrationDate ? v.registrationDate.toLocaleDateString("sl-SI") : "",
      v.nextServiceDate ? v.nextServiceDate.toLocaleDateString("sl-SI") : "",
      v.nextServiceKm ?? "",
      v.fuelTankVolumeL ?? "",
      v.currentDriver?.fullName ?? "",
      v.note ?? "",
    ]);
  }

  sheet.columns.forEach((col) => {
    col.width = 20;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const downloadName = `vozila-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${downloadName}"`,
    },
  });
}
