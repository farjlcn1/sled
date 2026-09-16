import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getTraccarPositions } from "@/lib/traccar";
import { vehicleWhereForUser } from "@/lib/vehicle-access";
import { deriveVehicleStatus, type VehicleStatus } from "@/lib/vehicle-status";

export type MobileVehicleStatus = {
  status: VehicleStatus;
  fuel: number | null;
  odometer: number | null;
  temperature: number | null;
  rpm: number | null;
  engineLoad: number | null;
};

function num(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

// Prva na voljo izmed treh kandidatnih atributov -- Traccar/Teltonika različno poimenuje
// temperaturo glede na model/senzor (coolantTemp prek CAN, engineTemp kot alias nekaterih
// profilov, deviceTemp -- temperatura naprave same, ne vozila -- kot najšibkejši približek).
function temperature(attributes: Record<string, unknown>): number | null {
  return num(attributes.coolantTemp) ?? num(attributes.engineTemp) ?? num(attributes.deviceTemp);
}

// Enkraten paketni klic za CEL voznikov vozni park namesto N zaporednih klicev na vozilo
// (glej app/api/vozila/[id]/status/route.ts, ki za en sam vnos potegne teden dni zgodovine in
// geokodiranje -- za mobilni seznam bi bilo N takih klicev prepočasno in po nepotrebnem drago).
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Ni prijavljen." }, { status: 401 });

  const vehicles = await prisma.vehicle.findMany({
    where: vehicleWhereForUser(user),
    select: { id: true, device: { select: { traccarDeviceId: true } } },
  });

  const byTraccarId = new Map(
    vehicles.filter((v) => v.device?.traccarDeviceId).map((v) => [v.device!.traccarDeviceId as number, v.id])
  );

  const result: Record<string, MobileVehicleStatus> = {};
  if (byTraccarId.size === 0) return NextResponse.json(result);

  const positions = await getTraccarPositions([...byTraccarId.keys()]);

  for (const position of positions) {
    const vehicleId = byTraccarId.get(position.deviceId);
    if (!vehicleId) continue;
    result[vehicleId] = {
      status: deriveVehicleStatus(position.attributes),
      fuel: num(position.attributes.fuel),
      odometer: num(position.attributes.odometer),
      temperature: temperature(position.attributes),
      rpm: num(position.attributes.rpm),
      engineLoad: num(position.attributes.engineLoad),
    };
  }

  return NextResponse.json(result);
}
