import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getTraccarPositions } from "@/lib/traccar";
import { vehicleWhereForUser } from "@/lib/vehicle-access";
import { deriveVehicleStatus, type VehicleStatus } from "@/lib/vehicle-status";

export type VehicleIcon = "CAR" | "VAN" | "TRUCK" | "EXCAVATOR" | "TRACTOR" | "MOTORCYCLE";

export type VehiclePosition = {
  vehicleId: string;
  plate: string;
  icon: VehicleIcon;
  latitude: number;
  longitude: number;
  course: number;
  speed: number;
  status: VehicleStatus;
  fixTime: string;
};

export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ positions: [] satisfies VehiclePosition[] });
  }

  // Vozila v zasebnem načinu se na živem zemljevidu ne prikažejo, ne glede na dostop uporabnika.
  const vehicles = await prisma.vehicle.findMany({
    where: { ...vehicleWhereForUser(user), device: { isNot: null }, isPrivateMode: false },
    select: { id: true, plate: true, icon: true, device: { select: { traccarDeviceId: true } } },
  });

  const byTraccarId = new Map(vehicles.filter((v) => v.device?.traccarDeviceId).map((v) => [v.device!.traccarDeviceId as number, v]));

  if (byTraccarId.size === 0) {
    return NextResponse.json({ positions: [] satisfies VehiclePosition[] });
  }

  const allPositions = await getTraccarPositions([...byTraccarId.keys()]);

  const positions: VehiclePosition[] = allPositions
    .filter((p) => byTraccarId.has(p.deviceId))
    .map((p) => {
      const vehicle = byTraccarId.get(p.deviceId)!;
      return {
        vehicleId: vehicle.id,
        plate: vehicle.plate,
        icon: vehicle.icon,
        latitude: p.latitude,
        longitude: p.longitude,
        course: p.course,
        speed: p.speed,
        status: deriveVehicleStatus(p.attributes),
        fixTime: p.fixTime,
      };
    });

  return NextResponse.json({ positions });
}
