import "server-only";
import { prisma } from "@/lib/db";
import { getTraccarDevices } from "@/lib/traccar";
import { logAudit } from "@/lib/audit";

// Traccarjev DATABASE_REGISTER_UNKNOWN=true (glej docker-compose.yml) ob prvi povezavi še
// neznane naprave to napravo sam vpiše v SVOJ seznam -- samo z IMEI, brez znamke/modela/
// serijske št./SIM, ker jih naprava po GPS protokolu (vrata 5027) sploh ne pošilja. Ta funkcija
// tak nov Traccarjev vnos zrcali v našo lastno tabelo naprav, da se prikaže na /admin/naprave --
// brez najemnika (nedodeljeno, kot že velja za ročno dodane naprave), z znamko "Teltonika" (edini
// protokol, ki ga ta strežnik posluša). Znamko/model/serijsko/SIM mora administrator vseeno
// vnesti ročno, ko fizično prevzame napravo -- teh podatkov ni mogoče prebrati iz GPS prometa.
export async function syncNewDevicesFromTraccar(): Promise<number> {
  const [traccarDevices, existingDevices] = await Promise.all([
    getTraccarDevices(),
    prisma.device.findMany({ select: { imei: true } }),
  ]);

  const knownImeis = new Set(existingDevices.map((d) => d.imei));
  const newDevices = traccarDevices.filter((d) => !knownImeis.has(d.uniqueId));

  let created = 0;
  for (const d of newDevices) {
    try {
      const device = await prisma.device.create({
        data: { imei: d.uniqueId, traccarDeviceId: d.id, protocol: "TELTONIKA", brand: "Teltonika" },
      });
      created++;
      await logAudit({
        userEmail: "sistem (traccar)",
        action: "CREATE",
        entityType: "Device",
        entityId: device.id,
        entityLabel: device.imei,
      });
    } catch {
      // Tekmovalni pogoj (npr. dve sočasni nalaganji /admin/naprave) -- imei je @unique, torej jo
      // je medtem že vpisal drug klic te iste funkcije; varno preskoči.
    }
  }
  return created;
}
