import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { vehicleWhereForUser } from "@/lib/vehicle-access";
import { ACTION_LABELS } from "@/lib/audit-labels";
import { EditVehicleSection } from "./edit-vehicle-section";

function fmtDateTime(d: Date): string {
  return d.toLocaleString("sl-SI", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtBool(b: boolean): string {
  return b ? "Da" : "Ne";
}

const FIELD_LABELS: Record<string, string> = {
  plate: "Registrska",
  brand: "Znamka",
  model: "Model",
  year: "Letnik",
  note: "Opomba",
  icon: "Ikona",
  fuelTankVolumeL: "Volumen rezervoarja",
  registrationDate: "Datum registracije",
  nextServiceDate: "Naslednji servis",
  nextServiceKm: "Naslednji servis (km)",
  deviceId: "Naprava",
  currentDriverId: "Trenutni voznik",
  isPrivateMode: "Zasebni način",
  minStopDurationMin: "Min. trajanje postanka",
  minMovingSpeedKmh: "Min. hitrost vožnje",
  tachoScheduleEnabled: "Urnik tahografa",
};

type ParsedChanges = Record<string, { from: unknown; to: unknown }>;

function parseChanges(changesJson: string | null): ParsedChanges | null {
  if (!changesJson) return null;
  try {
    return JSON.parse(changesJson) as ParsedChanges;
  } catch {
    return null;
  }
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-sm text-gray-900 dark:text-gray-100">{value}</dd>
    </div>
  );
}

export default async function VoziloDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, ...vehicleWhereForUser(user) },
    include: { currentDriver: true, device: true },
  });
  if (!vehicle) notFound();

  // Enako kot na seznamu vozil (vozila/page.tsx): proste naprave + trenutno dodeljena (ta sicer
  // ne bi bila med "prostimi", pa mora ostati izbirljiva, da ostane izbrana, če je ne spremenimo).
  const freeDevices = await prisma.device.findMany({
    where: { tenantId: vehicle.tenantId, vehicle: null },
    select: { id: true, imei: true, protocol: true, brand: true, model: true },
  });
  const availableDevices =
    vehicle.deviceId && !freeDevices.some((d) => d.id === vehicle.deviceId) && vehicle.device
      ? [...freeDevices, { id: vehicle.device.id, imei: vehicle.device.imei, protocol: vehicle.device.protocol, brand: vehicle.device.brand, model: vehicle.device.model }]
      : freeDevices;

  const auditEntries = await prisma.auditLog.findMany({
    where: { entityType: "Vehicle", entityId: id },
    orderBy: { createdAt: "desc" },
  });

  // Zberi vse driver ID-je, ki se kadarkoli pojavijo v currentDriverId spremembah (from ali to) --
  // changesJson hrani samo surove ID-je, imena razrešimo spodaj z eno poizvedbo.
  const driverIdsSeen = new Set<string>();
  const driverChanges: { createdAt: Date; to: string | null }[] = [];
  for (const entry of auditEntries) {
    const changes = parseChanges(entry.changesJson);
    const change = changes?.currentDriverId;
    if (!change) continue;
    const from = change.from as string | null;
    const to = change.to as string | null;
    if (from) driverIdsSeen.add(from);
    if (to) driverIdsSeen.add(to);
    driverChanges.push({ createdAt: entry.createdAt, to });
  }

  const seenDrivers =
    driverIdsSeen.size > 0
      ? await prisma.driver.findMany({ where: { id: { in: Array.from(driverIdsSeen) } }, select: { id: true, fullName: true } })
      : [];
  const driverNameById = new Map(seenDrivers.map((d) => [d.id, d.fullName]));

  // Razločni vozniki, ki so bili kadarkoli dejansko dodeljeni (torej "to" vrednost), najnovejši prvi.
  const everAssigned: { id: string; fullName: string; lastAssignedAt: Date }[] = [];
  const addedIds = new Set<string>();
  for (const change of driverChanges) {
    if (!change.to || addedIds.has(change.to)) continue;
    addedIds.add(change.to);
    everAssigned.push({
      id: change.to,
      fullName: driverNameById.get(change.to) ?? change.to,
      lastAssignedAt: change.createdAt,
    });
  }
  if (vehicle.currentDriverId && !addedIds.has(vehicle.currentDriverId)) {
    everAssigned.unshift({
      id: vehicle.currentDriverId,
      fullName: vehicle.currentDriver?.fullName ?? vehicle.currentDriverId,
      lastAssignedAt: vehicle.updatedAt,
    });
  }

  function formatChangeValue(field: string, value: unknown): string {
    if (field === "currentDriverId") return value ? (driverNameById.get(value as string) ?? String(value)) : "brez";
    if (value === null || value === undefined || value === "") return "—";
    return String(value);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {vehicle.plate}
        {(vehicle.brand || vehicle.model) && (
          <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">
            {[vehicle.brand, vehicle.model].filter(Boolean).join(" ")}
          </span>
        )}
      </h1>

      <section className="rounded-md border border-gray-200 p-4 dark:border-gray-700">
        <h2 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Podatki o vozilu</h2>
        <EditVehicleSection
          vehicle={{
            id: vehicle.id,
            plate: vehicle.plate,
            brand: vehicle.brand,
            model: vehicle.model,
            year: vehicle.year,
            icon: vehicle.icon,
            fuelTankVolumeL: vehicle.fuelTankVolumeL,
            note: vehicle.note,
            deviceId: vehicle.deviceId,
            registrationDate: vehicle.registrationDate?.toISOString() ?? null,
            nextServiceDate: vehicle.nextServiceDate?.toISOString() ?? null,
            nextServiceKm: vehicle.nextServiceKm,
          }}
          availableDevices={availableDevices}
        />
      </section>

      <section className="rounded-md border border-gray-200 p-4 dark:border-gray-700">
        <h2 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Dodatno</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          <Field label="Trenutni voznik" value={vehicle.currentDriver?.fullName ?? "—"} />
          <Field label="Zasebni način" value={fmtBool(vehicle.isPrivateMode)} />
          <Field label="Urnik tahografa" value={fmtBool(vehicle.tachoScheduleEnabled)} />
          <Field label="Min. trajanje postanka" value={`${vehicle.minStopDurationMin} min`} />
          <Field label="Min. hitrost vožnje" value={`${vehicle.minMovingSpeedKmh} km/h`} />
          <Field label="Ustvarjeno" value={fmtDateTime(vehicle.createdAt)} />
          <Field label="Nazadnje urejeno" value={fmtDateTime(vehicle.updatedAt)} />
        </dl>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Trenutnega voznika urejaš v zavihku Vozniki — tu prikazano samo za pregled.
        </p>
      </section>

      <section className="rounded-md border border-gray-200 p-4 dark:border-gray-700">
        <h2 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
          Vsi kadarkoli dodeljeni vozniki ({everAssigned.length})
        </h2>
        {everAssigned.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Ni zabeleženih dodelitev voznika.</p>
        ) : (
          <ul className="space-y-1.5">
            {everAssigned.map((d) => (
              <li key={d.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-900 dark:text-gray-100">
                  {d.fullName}
                  {d.id === vehicle.currentDriverId && (
                    <span className="ml-2 text-xs font-medium text-green-600 dark:text-green-400">(trenutni)</span>
                  )}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{fmtDateTime(d.lastAssignedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-md border border-gray-200 p-4 dark:border-gray-700">
        <h2 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
          Zgodovina urejanja ({auditEntries.length})
        </h2>
        {auditEntries.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Ni zabeleženih sprememb.</p>
        ) : (
          <ul className="space-y-2">
            {auditEntries.map((entry) => {
              const changes = parseChanges(entry.changesJson);
              const changesText = changes
                ? Object.entries(changes)
                    .map(([field, { from, to }]) => {
                      const label = FIELD_LABELS[field] ?? field;
                      return `${label}: ${formatChangeValue(field, from)} → ${formatChangeValue(field, to)}`;
                    })
                    .join(", ")
                : entry.changesJson;
              return (
                <li key={entry.id} className="border-b border-gray-100 pb-2 text-sm last:border-0 dark:border-gray-800">
                  <div className="flex items-center justify-between text-gray-900 dark:text-gray-100">
                    <span>
                      {ACTION_LABELS[entry.action] ?? entry.action} — {entry.userEmail}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{fmtDateTime(entry.createdAt)}</span>
                  </div>
                  {changesText && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{changesText}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
