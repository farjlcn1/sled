import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { vehicleWhereForUser } from "@/lib/vehicle-access";
import { computeHistoryRowsWithFallback, effectiveTraccarDeviceId, endOfDay } from "@/lib/history-data";

function formatFieldLabel(key: string): string {
  const spaced = key.replace(/([A-Z])/g, " $1");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export async function GET(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Ni prijavljen." }, { status: 401 });

  const url = new URL(req.url);
  const vehicleId = url.searchParams.get("vozilo");
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  if (!vehicleId || !fromParam || !toParam) {
    return NextResponse.json({ error: "Manjkajo parametri." }, { status: 400 });
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, ...vehicleWhereForUser(user) },
    select: {
      id: true,
      plate: true,
      archivedTraccarDeviceId: true,
      device: { select: { traccarDeviceId: true } },
    },
  });
  if (!vehicle) return NextResponse.json({ error: "Vozilo ni na voljo." }, { status: 404 });

  const historyVehicle = { id: vehicle.id, device: { traccarDeviceId: effectiveTraccarDeviceId(vehicle) } };
  const rows = await computeHistoryRowsWithFallback(historyVehicle, new Date(fromParam), endOfDay(toParam));

  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (key !== "fixTime") keys.add(key);
    }
  }
  const dataKeys = Array.from(keys).sort();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Zgodovina");
  sheet.addRow(["Čas", ...dataKeys.map(formatFieldLabel)]).font = { bold: true };
  for (const row of rows) {
    sheet.addRow([
      new Date(row.fixTime).toLocaleString("sl-SI"),
      ...dataKeys.map((k) => {
        const v = row[k];
        if (typeof v === "boolean") return v ? "Da" : "Ne";
        return v ?? "";
      }),
    ]);
  }
  sheet.columns.forEach((col) => {
    col.width = 18;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const safePlate = vehicle.plate.replace(/[^a-zA-Z0-9-_]+/g, "-");
  const filename = `${safePlate}_${fromParam}_${toParam}.xlsx`;

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
