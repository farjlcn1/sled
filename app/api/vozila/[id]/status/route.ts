import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getTraccarRoute } from "@/lib/traccar";
import { vehicleWhereForUser } from "@/lib/vehicle-access";
import { deriveVehicleStatus, type VehicleStatus } from "@/lib/vehicle-status";
import { isMoving } from "@/lib/trips";
import { reverseGeocode } from "@/lib/photon";

export type VehicleQuickStatus = {
  fixTime: string;
  latitude: number;
  longitude: number;
  naslov: string | null;
  status: VehicleStatus;
  ignition: boolean | null;
  odometer: number | null;
  fuel: number | null;
  stateDurationMin: number;
};

const WINDOW_HOURS = 24 * 7;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Ni prijavljen." }, { status: 401 });

  const { id } = await params;
  const vehicle = await prisma.vehicle.findFirst({
    where: { id, ...vehicleWhereForUser(user) },
    include: { device: true },
  });
  if (!vehicle || !vehicle.device?.traccarDeviceId) {
    return NextResponse.json({ error: "Vozilo ni na voljo." }, { status: 404 });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_HOURS * 3600 * 1000);
  const positions = await getTraccarRoute(vehicle.device.traccarDeviceId, windowStart, now);
  if (positions.length === 0) {
    return NextResponse.json({ error: "Ni podatkov." }, { status: 404 });
  }

  const last = positions[positions.length - 1];
  const lastMoving = isMoving(last, vehicle.minMovingSpeedKmh);

  let stateStart = last.fixTime;
  for (let i = positions.length - 2; i >= 0; i--) {
    if (isMoving(positions[i], vehicle.minMovingSpeedKmh) !== lastMoving) break;
    stateStart = positions[i].fixTime;
  }
  const stateDurationMin = Math.round(
    (new Date(last.fixTime).getTime() - new Date(stateStart).getTime()) / 60000
  );

  const address = await reverseGeocode(last.latitude, last.longitude);

  const result: VehicleQuickStatus = {
    fixTime: last.fixTime,
    latitude: last.latitude,
    longitude: last.longitude,
    naslov: address,
    status: deriveVehicleStatus(last.attributes),
    ignition: typeof last.attributes.ignition === "boolean" ? last.attributes.ignition : null,
    odometer: typeof last.attributes.odometer === "number" ? last.attributes.odometer : null,
    fuel: typeof last.attributes.fuel === "number" ? last.attributes.fuel : null,
    stateDurationMin,
  };

  return NextResponse.json(result);
}
