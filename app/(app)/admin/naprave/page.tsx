import { requirePlatformAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { syncNewDevicesFromTraccar } from "@/lib/device-sync";
import { AddDeviceForm } from "./add-device-form";
import { ImportDevicesForm } from "./import-devices-form";
import { DevicesTable, type DeviceRow } from "./devices-table";
import { PROTOCOL_OPTIONS } from "./protocol-options";

function fieldClass() {
  return "w-full mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
}

type NapraveFilters = {
  imei?: string;
  znamkaModel?: string;
  serijska?: string;
  sim?: string;
  protokol?: string;
  podjetje?: string;
  vozilo?: string;
  letnik?: string;
};

export default async function NapravePage({
  searchParams,
}: {
  searchParams: Promise<NapraveFilters>;
}) {
  await requirePlatformAdmin();
  const filters = await searchParams;

  // Najprej zrcali morebitne na novo zaznane Traccar naprave v našo tabelo (glej lib/device-sync)
  // -- best-effort, da začasno nedosegljiv Traccar ne podre cele strani.
  try {
    await syncNewDevicesFromTraccar();
  } catch (err) {
    console.error("Sinhronizacija naprav iz Traccarja ni uspela:", err);
  }

  const where: Prisma.DeviceWhereInput = {};
  if (filters.imei) where.imei = { contains: filters.imei, mode: "insensitive" };
  if (filters.znamkaModel) {
    where.OR = [
      { brand: { contains: filters.znamkaModel, mode: "insensitive" } },
      { model: { contains: filters.znamkaModel, mode: "insensitive" } },
    ];
  }
  if (filters.serijska) where.serialNumber = { contains: filters.serijska, mode: "insensitive" };
  if (filters.sim) where.simNumber = { contains: filters.sim, mode: "insensitive" };
  if (filters.protokol) where.protocol = filters.protokol as Prisma.DeviceWhereInput["protocol"];
  if (filters.podjetje) where.tenantId = filters.podjetje;

  const vehicleWhere: Prisma.VehicleWhereInput = {};
  if (filters.vozilo) vehicleWhere.plate = { contains: filters.vozilo, mode: "insensitive" };
  if (filters.letnik) {
    const year = Number(filters.letnik);
    if (!Number.isNaN(year)) vehicleWhere.year = year;
  }
  if (Object.keys(vehicleWhere).length > 0) where.vehicle = vehicleWhere;

  const [devices, tenants] = await Promise.all([
    prisma.device.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { tenant: true, vehicle: true },
    }),
    prisma.tenant.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const deviceRows: DeviceRow[] = devices.map((d) => ({
    id: d.id,
    imei: d.imei,
    brand: d.brand,
    model: d.model,
    serialNumber: d.serialNumber,
    simNumber: d.simNumber,
    iccid: d.iccid,
    traccarDeviceId: d.traccarDeviceId,
    protocol: d.protocol,
    note: d.note,
    tenantId: d.tenantId,
    tenantName: d.tenant?.name ?? null,
    vehiclePlate: d.vehicle?.plate ?? null,
    vehicleYear: d.vehicle?.year ?? null,
  }));

  return (
    <div className="space-y-6">
      <AddDeviceForm />
      <ImportDevicesForm />

      <form
        method="get"
        className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:grid-cols-4"
      >
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
          IMEI
          <input name="imei" defaultValue={filters.imei} className={fieldClass()} />
        </label>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Znamka/model
          <input name="znamkaModel" defaultValue={filters.znamkaModel} className={fieldClass()} />
        </label>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Serijska št.
          <input name="serijska" defaultValue={filters.serijska} className={fieldClass()} />
        </label>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
          SIM
          <input name="sim" defaultValue={filters.sim} className={fieldClass()} />
        </label>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Protokol
          <select name="protokol" defaultValue={filters.protokol ?? ""} className={fieldClass()}>
            <option value="">vsi</option>
            {PROTOCOL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Podjetje
          <select name="podjetje" defaultValue={filters.podjetje ?? ""} className={fieldClass()}>
            <option value="">vsa</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Vozilo
          <input name="vozilo" defaultValue={filters.vozilo} placeholder="registrska" className={fieldClass()} />
        </label>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Letnik vozila
          <input type="number" name="letnik" defaultValue={filters.letnik} className={`${fieldClass()} no-spinner`} />
        </label>
        <div className="col-span-2 flex items-end gap-2 sm:col-span-4">
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            Filtriraj
          </button>
          <a href="/admin/naprave" className="text-sm text-gray-500 underline dark:text-gray-400">
            Počisti filtre
          </a>
        </div>
      </form>

      <DevicesTable devices={deviceRows} tenants={tenants} />
    </div>
  );
}
