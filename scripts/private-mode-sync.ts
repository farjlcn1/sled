// Sinhronizacija zasebnega načina po DIN -- teče prek sledenje-private-mode.timer (glej
// deploy/private-mode/), redno (privzeto vsakih 5 min). Za vsako vozilo, ki ima nastavljen
// privateModeDin (glej Vozila -> Uredi -> "Zasebni način"), prebere zadnjo znano pozicijo naprave
// prek Traccarjevega REST API-ja (isti /api/positions?deviceId=X kot lib/traccar.ts uporablja
// povsod drugod v aplikaciji) in stanje DIN{N} (attributes.in{N}) zrcali v isPrivateMode -- za TO
// vozilo DIN postane vir resnice in lahko prepiše tudi ročno nastavljeno stanje (glej
// startPrivateMode/endPrivateMode v app/(app)/vozila/actions.ts za ročno pot, ki ostaja edina
// možnost za vozila brez nastavljenega privateModeDin).
import "dotenv/config";
import { prisma } from "../lib/db";
import { getTraccarPositions } from "../lib/traccar";
import { startPrivateModeForVehicle, endPrivateModeForVehicle } from "../lib/private-mode";

async function main() {
  const vehicles = await prisma.vehicle.findMany({
    where: { privateModeDin: { not: null }, device: { traccarDeviceId: { not: null } } },
    include: { device: { select: { traccarDeviceId: true } } },
  });
  console.log(`Sinhronizacija zasebnega načina po DIN: ${vehicles.length} vozil ima nastavljen DIN.`);

  for (const v of vehicles) {
    const traccarDeviceId = v.device?.traccarDeviceId;
    if (!traccarDeviceId) continue; // ne bi smelo priti do sem (where že to zahteva), za type-safety

    let positions;
    try {
      positions = await getTraccarPositions([traccarDeviceId]);
    } catch (err) {
      console.log(`${v.plate}: napaka pri branju pozicije -- ${err instanceof Error ? err.message : err}`);
      continue;
    }

    const latest = positions[0];
    if (!latest) {
      console.log(`${v.plate}: ni znane pozicije, preskočeno.`);
      continue;
    }

    const dinKey = `in${v.privateModeDin}`;
    const dinValue = latest.attributes[dinKey];
    if (typeof dinValue !== "boolean") {
      console.log(`${v.plate}: DIN${v.privateModeDin} (${dinKey}) ni na voljo v zadnji poziciji, preskočeno.`);
      continue;
    }

    if (dinValue && !v.isPrivateMode) {
      await startPrivateModeForVehicle(v.id, "WITH_MILEAGE");
      console.log(`${v.plate}: DIN${v.privateModeDin} aktiven -- vklopljen zasebni način.`);
    } else if (!dinValue && v.isPrivateMode) {
      await endPrivateModeForVehicle(v.id);
      console.log(`${v.plate}: DIN${v.privateModeDin} neaktiven -- izklopljen zasebni način.`);
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
