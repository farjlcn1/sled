import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { vehicleWhereForUser } from "@/lib/vehicle-access";
import { computeVehicleReport } from "@/lib/report-data";
import type { RouteSummary } from "@/lib/trips";

export type TodaySummary =
  | { ok: true; plate: string; summary: RouteSummary; privateDistanceKm: number; hadPrivatePeriods: boolean }
  | { ok: false; plate: string; error: string };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Ni prijavljen." }, { status: 401 });

  const { id } = await params;
  const vehicle = await prisma.vehicle.findFirst({
    where: { id, ...vehicleWhereForUser(user) },
    include: { device: true },
  });
  if (!vehicle) return NextResponse.json({ error: "Vozilo ni na voljo." }, { status: 404 });

  // Lokalna polnoč danes (vsebnik teče v Europe/Ljubljana, glej Dockerfile) -- do zdaj.
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  const result = await computeVehicleReport(vehicle, startOfToday, now);
  if (!result.ok) {
    const body: TodaySummary = { ok: false, plate: result.plate, error: result.error };
    return NextResponse.json(body);
  }

  // positions ni potreben za povzetek, samo obremenjuje odgovor -- pošlji samo izračunano.
  const body: TodaySummary = {
    ok: true,
    plate: result.plate,
    summary: result.summary,
    privateDistanceKm: result.privateDistanceKm,
    hadPrivatePeriods: result.hadPrivatePeriods,
  };
  return NextResponse.json(body);
}
