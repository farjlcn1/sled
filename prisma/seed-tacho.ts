// Ustvari nekaj testnih tahografskih datotek (vozila + vozniki) za podjetje "pegam", da je zavihek
// Tacho mogoče preizkusiti brez dejanskega vira DDD datotek. Poganja se ročno: npx tsx prisma/seed-tacho.ts
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { encode } from "../lib/tacho/encode";
import { ActivityType, EventType, type ActivityRecord, type EventRecord } from "../lib/tacho/format";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function hours(n: number) {
  return n * 60 * 60 * 1000;
}

function buildDriverActivities(startDay: Date, days: number): ActivityRecord[] {
  const activities: ActivityRecord[] = [];
  for (let d = 0; d < days; d++) {
    const dayStart = new Date(startDay.getTime() + d * hours(24));
    activities.push({ time: new Date(dayStart.getTime() + hours(6)), activityType: ActivityType.DELO });
    activities.push({ time: new Date(dayStart.getTime() + hours(6.25)), activityType: ActivityType.VOZNJA });
    activities.push({ time: new Date(dayStart.getTime() + hours(10.5)), activityType: ActivityType.POCITEK });
    activities.push({ time: new Date(dayStart.getTime() + hours(11)), activityType: ActivityType.VOZNJA });
    activities.push({ time: new Date(dayStart.getTime() + hours(14)), activityType: ActivityType.RAZPOLOZLJIVOST });
    activities.push({ time: new Date(dayStart.getTime() + hours(14.5)), activityType: ActivityType.VOZNJA });
    activities.push({ time: new Date(dayStart.getTime() + hours(17)), activityType: ActivityType.DELO });
    activities.push({ time: new Date(dayStart.getTime() + hours(17.5)), activityType: ActivityType.POCITEK });
  }
  return activities;
}

function buildDriverEvents(startDay: Date, days: number): EventRecord[] {
  const events: EventRecord[] = [];
  for (let d = 0; d < days; d++) {
    const dayStart = new Date(startDay.getTime() + d * hours(24));
    events.push({ time: new Date(dayStart.getTime() + hours(6)), eventType: EventType.VSTAVITEV_KARTICE, description: "Začetek izmene" });
    events.push({ time: new Date(dayStart.getTime() + hours(18)), eventType: EventType.ODSTRANITEV_KARTICE, description: "Konec izmene" });
  }
  return events;
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { name: "pegam" } });
  if (!tenant) {
    console.error("Podjetje 'pegam' ne obstaja — najprej poženi glavni seed/ustvari podjetje.");
    process.exit(1);
  }

  const vehicles = await prisma.vehicle.findMany({ where: { tenantId: tenant.id }, orderBy: { plate: "asc" }, take: 3 });
  const drivers = await prisma.driver.findMany({ where: { tenantId: tenant.id }, orderBy: { fullName: "asc" }, take: 3 });

  if (vehicles.length === 0 || drivers.length === 0) {
    console.error("Ni najdenih vozil/voznikov za podjetje pegam.");
    process.exit(1);
  }

  const now = new Date("2026-08-01T00:00:00.000Z");

  for (const vehicle of vehicles) {
    const periodFrom = new Date(now.getTime() - 30 * hours(24));
    const periodTo = now;
    const buf = encode({
      kind: "VOZILO",
      plate: vehicle.plate,
      vin: `TEST${vehicle.id.slice(0, 13).toUpperCase()}`,
      odometerKm: 45000 + Math.round(Math.random() * 50000),
      periodFrom,
      periodTo,
      events: [
        { time: new Date(periodFrom.getTime() + hours(3)), eventType: EventType.PREKORACITEV_HITROSTI, description: "132 km/h" },
        { time: new Date(periodFrom.getTime() + hours(50)), eventType: EventType.NAPAKA_NAPRAVE, description: "Kratka izguba GNSS signala" },
      ],
    });

    await prisma.tachoFile.create({
      data: {
        tenantId: tenant.id,
        kind: "VOZILO",
        vehicleId: vehicle.id,
        fileName: `${vehicle.plate.replace(/\s+/g, "-")}_VU_${periodFrom.toISOString().slice(0, 10)}_${periodTo.toISOString().slice(0, 10)}.ddd`,
        fileSize: buf.length,
        periodFrom,
        periodTo,
        rawData: new Uint8Array(buf),
      },
    });
    console.log(`Ustvarjena testna VU datoteka za ${vehicle.plate}`);
  }

  for (const driver of drivers) {
    const periodFrom = new Date(now.getTime() - 5 * hours(24));
    const periodTo = now;
    const buf = encode({
      kind: "VOZNIK",
      fullName: driver.fullName,
      idCode: driver.idCode ?? `KARTICA-${driver.id.slice(0, 8)}`,
      activities: buildDriverActivities(periodFrom, 5),
      events: buildDriverEvents(periodFrom, 5),
    });

    await prisma.tachoFile.create({
      data: {
        tenantId: tenant.id,
        kind: "VOZNIK",
        driverId: driver.id,
        fileName: `${driver.fullName.replace(/\s+/g, "-")}_kartica_${periodFrom.toISOString().slice(0, 10)}_${periodTo.toISOString().slice(0, 10)}.ddd`,
        fileSize: buf.length,
        periodFrom,
        periodTo,
        rawData: new Uint8Array(buf),
      },
    });
    console.log(`Ustvarjena testna datoteka kartice za ${driver.fullName}`);
  }

  console.log("Končano.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
