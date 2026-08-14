import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { vehicleWhereForUser } from "@/lib/vehicle-access";
import { computeVehicleReport, type VehicleReportResult } from "@/lib/report-data";
import {
  computeFuelReport,
  computeSpeedReport,
  computeEcoReport,
  computeAllDataRows,
  collectDataKeys,
  type ReportType,
} from "@/lib/report-types";

// Če "do" nima izrecno nastavljene ure (privzeta polnoč ob izbiri samo dneva), ga obravnavamo
// kot vključno do konca tega dne — sicer bi izbira samo dneva brez ure izključila skoraj ves dan.
function inclusiveEnd(value: string): Date {
  const d = new Date(value);
  if (d.getHours() === 0 && d.getMinutes() === 0) d.setHours(23, 59, 59, 999);
  return d;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("sl-SI", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function fmtTimeSec(iso: string) {
  return new Date(iso).toLocaleString("sl-SI", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function addVoznjeSheet(sheet: ExcelJS.Worksheet, report: VehicleReportResult & { ok: true }) {
  sheet.addRow(["Prevoženo (km)", "Čas vožnje (min)", "Št. voženj"]).font = { bold: true };
  sheet.addRow([
    Number((report.summary.totalDistanceKm + report.privateDistanceKm).toFixed(1)),
    Math.round(report.summary.totalDrivingMin),
    report.summary.trips.length,
  ]);
  sheet.addRow([]);
  sheet.addRow(["Začetek", "Konec", "Trajanje (min)", "Razdalja (km)", "Najv. hitrost (km/h)"]).font = { bold: true };
  for (const t of report.summary.trips) {
    sheet.addRow([
      fmtTime(t.startTime),
      fmtTime(t.endTime),
      Math.round(t.durationMin),
      Number(t.distanceKm.toFixed(1)),
      Math.round(t.maxSpeedKmh),
    ]);
  }
}

function addPostankiSheet(sheet: ExcelJS.Worksheet, report: VehicleReportResult & { ok: true }) {
  sheet.addRow(["Št. postankov", "Čas postankov (min)"]).font = { bold: true };
  sheet.addRow([report.summary.stops.length, Math.round(report.summary.totalStoppedMin)]);
  sheet.addRow([]);
  sheet.addRow(["Začetek", "Konec", "Trajanje (min)"]).font = { bold: true };
  for (const s of report.summary.stops) {
    sheet.addRow([fmtTime(s.startTime), fmtTime(s.endTime), Math.round(s.durationMin)]);
  }
}

function addGorivoSheet(sheet: ExcelJS.Worksheet, report: VehicleReportResult & { ok: true }) {
  const fuel = computeFuelReport(report.positions);
  sheet.addRow(["Na začetku (%)", "Na koncu (%)", "Sprememba (%)"]).font = { bold: true };
  sheet.addRow([fuel.startPct ?? "", fuel.endPct ?? "", fuel.usedPct ?? ""]);
  sheet.addRow([]);
  sheet.addRow(["Sumljivi padci goriva"]).font = { bold: true };
  sheet.addRow(["Od", "Do", "Od (%)", "Do (%)", "Sprememba (%)"]).font = { bold: true };
  for (const d of fuel.drops) {
    sheet.addRow([fmtTimeSec(d.fromTime), fmtTimeSec(d.toTime), d.fromPct, d.toPct, -d.deltaPct]);
  }
  sheet.addRow([]);
  sheet.addRow(["Vse meritve goriva"]).font = { bold: true };
  sheet.addRow(["Čas", "Gorivo (%)"]).font = { bold: true };
  for (const r of fuel.readings) {
    sheet.addRow([fmtTimeSec(r.time), r.fuelPct]);
  }
}

function addHitrostSheet(sheet: ExcelJS.Worksheet, report: VehicleReportResult & { ok: true }) {
  const speed = computeSpeedReport(report.positions, report.summary.trips);
  sheet.addRow(["Najvišja hitrost (km/h)", "Povprečna hitrost (km/h)", `Prekoračitve (>${speed.overspeedThresholdKmh} km/h)`]).font = {
    bold: true,
  };
  sheet.addRow([speed.maxSpeedKmh, speed.avgMovingSpeedKmh, speed.overspeedEvents.length]);
  sheet.addRow([]);
  sheet.addRow(["Porazdelitev hitrosti"]).font = { bold: true };
  sheet.addRow(["Razpon", "Št. točk"]).font = { bold: true };
  for (const b of speed.buckets) {
    sheet.addRow([b.label, b.count]);
  }
  sheet.addRow([]);
  sheet.addRow(["Prekoračitve hitrosti"]).font = { bold: true };
  sheet.addRow(["Čas", "Hitrost (km/h)"]).font = { bold: true };
  for (const e of speed.overspeedEvents) {
    sheet.addRow([fmtTimeSec(e.time), e.speedKmh]);
  }
  sheet.addRow([]);
  sheet.addRow(["Hitrost po vožnjah"]).font = { bold: true };
  sheet.addRow(["Začetek", "Konec", "Povp. hitrost (km/h)", "Najv. hitrost (km/h)"]).font = { bold: true };
  for (const t of speed.tripSpeeds) {
    sheet.addRow([fmtTime(t.startTime), fmtTime(t.endTime), t.avgSpeedKmh, t.maxSpeedKmh]);
  }
}

function addEkoSheet(sheet: ExcelJS.Worksheet, report: VehicleReportResult & { ok: true }, fuelTankVolumeL: number | null) {
  const eco = computeEcoReport(report.positions, {
    distanceKm: report.summary.totalDistanceKm,
    drivingMin: report.summary.totalDrivingMin,
    fuelUsedPct: report.summary.fuelUsedPct,
    fuelTankVolumeL,
  });
  sheet.addRow(["Prevoženo (km)", "Čas mirovanja z vklop. motorjem (min)", "Sunkovite spremembe hitrosti", "Poraba (L/100km)"]).font =
    { bold: true };
  sheet.addRow([Number(eco.distanceKm.toFixed(1)), Math.round(eco.idlingMin), eco.harshEventsCount, eco.fuelPer100km ?? ""]);
  sheet.addRow([]);
  sheet.addRow([
    "Opomba: sunkovite spremembe hitrosti so ocenjene iz GPS podatkov (>25 km/h med dvema zaporednima točkama v manj kot 20 s), ne iz pravega pospeškometra.",
  ]);
}

function addVseSheet(sheet: ExcelJS.Worksheet, report: VehicleReportResult & { ok: true }) {
  const rows = computeAllDataRows(report.positions);
  const keys = collectDataKeys(rows);
  sheet.addRow(["Čas", ...keys]).font = { bold: true };
  for (const row of rows) {
    sheet.addRow([
      fmtTimeSec(row.fixTime),
      ...keys.map((k) => {
        const v = row[k];
        if (typeof v === "boolean") return v ? "Da" : "Ne";
        return v ?? "";
      }),
    ]);
  }
}

function addVehicleSheet(
  workbook: ExcelJS.Workbook,
  plate: string,
  report: VehicleReportResult,
  type: ReportType,
  fuelTankVolumeL: number | null
) {
  // Imena delovnih listov so v xlsx omejena na 31 znakov in ne smejo vsebovati npr. "/".
  const safeName = plate.replace(/[\\/*?:[\]]/g, " ").slice(0, 31) || "Vozilo";
  const sheet = workbook.addWorksheet(safeName);

  if (!report.ok) {
    sheet.addRow(["Napaka", report.error]);
    return;
  }

  switch (type) {
    case "postanki":
      addPostankiSheet(sheet, report);
      break;
    case "gorivo":
      addGorivoSheet(sheet, report);
      break;
    case "hitrost":
      addHitrostSheet(sheet, report);
      break;
    case "eko":
      addEkoSheet(sheet, report, fuelTankVolumeL);
      break;
    case "vse":
      addVseSheet(sheet, report);
      break;
    default:
      addVoznjeSheet(sheet, report);
  }

  sheet.columns.forEach((col) => {
    col.width = 20;
  });
}

const VALID_TYPES = ["voznje", "postanki", "gorivo", "hitrost", "eko", "vse"] as const;

export async function GET(req: Request) {
  const user = await getSession();
  if (!user || !user.canViewReports) {
    return NextResponse.json({ error: "Ni dovoljeno." }, { status: 403 });
  }

  const url = new URL(req.url);
  const vehicleId = url.searchParams.get("vehicleId");
  const groupId = url.searchParams.get("groupId");
  const tipParam = url.searchParams.get("tip");
  const reportType: ReportType = (VALID_TYPES as readonly string[]).includes(tipParam ?? "")
    ? (tipParam as ReportType)
    : "voznje";
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  const fromDate = fromParam ? new Date(fromParam) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const toDate = toParam ? inclusiveEnd(toParam) : new Date();
  const periodSuffix = `${fromParam ?? fromDate.toISOString().slice(0, 10)}_${toParam ?? toDate.toISOString().slice(0, 10)}`;

  const workbook = new ExcelJS.Workbook();
  let downloadName = "porocilo.xlsx";

  if (groupId) {
    const group = await prisma.vehicleGroup.findFirst({ where: { id: groupId }, select: { name: true } });
    const groupVehicles = await prisma.vehicle.findMany({
      where: { ...vehicleWhereForUser(user), groupMemberships: { some: { groupId } } },
      orderBy: { plate: "asc" },
      select: {
        id: true,
        plate: true,
        minStopDurationMin: true,
        minMovingSpeedKmh: true,
        fuelTankVolumeL: true,
        device: { select: { traccarDeviceId: true } },
      },
    });
    if (groupVehicles.length === 0) {
      return NextResponse.json({ error: "V tej skupini ni dostopnih vozil." }, { status: 404 });
    }
    for (const vehicle of groupVehicles) {
      const report = await computeVehicleReport(vehicle, fromDate, toDate);
      addVehicleSheet(workbook, vehicle.plate, report, reportType, vehicle.fuelTankVolumeL);
    }
    downloadName = `porocilo-${(group?.name ?? "skupina").replace(/[^a-zA-Z0-9-_]+/g, "-")}-${periodSuffix}.xlsx`;
  } else if (vehicleId) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, ...vehicleWhereForUser(user) },
      select: {
        id: true,
        plate: true,
        minStopDurationMin: true,
        minMovingSpeedKmh: true,
        fuelTankVolumeL: true,
        device: { select: { traccarDeviceId: true } },
      },
    });
    if (!vehicle) {
      return NextResponse.json({ error: "Vozilo ni na voljo." }, { status: 404 });
    }
    const report = await computeVehicleReport(vehicle, fromDate, toDate);
    addVehicleSheet(workbook, vehicle.plate, report, reportType, vehicle.fuelTankVolumeL);
    downloadName = `porocilo-${vehicle.plate.replace(/[^a-zA-Z0-9-_]+/g, "-")}-${periodSuffix}.xlsx`;
  } else {
    return NextResponse.json({ error: "Manjka vozilo ali skupina." }, { status: 400 });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${downloadName}"`,
    },
  });
}
