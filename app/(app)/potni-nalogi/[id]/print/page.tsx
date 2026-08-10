import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { PrintButton } from "./print-button";

const STATUS_LABELS: Record<string, string> = {
  ODREJEN: "Odrejen",
  V_TEKU: "V teku",
  ZAKLJUCEN: "Zaključen",
  LIKVIDIRAN: "Likvidiran",
};

function fmtDateTime(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleString("sl-SI", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("sl-SI", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-gray-300 pb-1">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm text-gray-900">{value}</div>
    </div>
  );
}

export default async function PotniNalogPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user.canManageUsers) {
    return <p className="text-sm text-gray-600 dark:text-gray-400">Nimaš dovoljenja za ogled potnih nalogov.</p>;
  }

  const { id } = await params;
  const nalog = await prisma.potniNalog.findUnique({
    where: { id },
    include: { vehicle: true, driver: true, tenant: true },
  });
  if (!nalog) notFound();
  if (!user.canManagePlatform && nalog.tenantId !== user.tenantId) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6 bg-white p-6 text-gray-900 print:p-0">
      <div className="no-print flex justify-end">
        <PrintButton />
      </div>

      <div className="flex items-start justify-between border-b border-gray-900 pb-3">
        <div>
          <h1 className="text-lg font-bold">POTNI NALOG</h1>
          <p className="text-sm text-gray-600">{nalog.tenant.name}</p>
        </div>
        <div className="text-right text-sm">
          <div>
            Št.: <span className="font-semibold">{nalog.number}</span>
          </div>
          <div>Datum izdaje: {fmtDate(nalog.issuedAt)}</div>
          <div>Status: {STATUS_LABELS[nalog.status]}</div>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase text-gray-500">Odredba</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Odredbodajalec" value={nalog.issuedByName} />
          <Field label="Voznik" value={nalog.driver?.fullName ?? "—"} />
          <Field label="Vozilo" value={`${nalog.vehicle.plate}${nalog.vehicle.brand ? ` (${nalog.vehicle.brand} ${nalog.vehicle.model ?? ""})` : ""}`} />
          <Field label="Namen poti" value={nalog.purpose} />
          <Field label="Relacija" value={`${nalog.plannedFrom}${nalog.plannedVia ? ` – ${nalog.plannedVia}` : ""} – ${nalog.plannedTo}`} />
          <Field label="Planiran odhod" value={fmtDateTime(nalog.plannedDepartureAt)} />
          <Field label="Planirana vrnitev" value={fmtDateTime(nalog.plannedReturnAt)} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase text-gray-500">Obračun (dejanski podatki)</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dejanski odhod" value={fmtDateTime(nalog.actualDepartureAt)} />
          <Field label="Dejanska vrnitev" value={fmtDateTime(nalog.actualReturnAt)} />
          <Field label="Stanje števca — začetek" value={nalog.startOdometerKm !== null ? `${nalog.startOdometerKm} km` : "—"} />
          <Field label="Stanje števca — konec" value={nalog.endOdometerKm !== null ? `${nalog.endOdometerKm} km` : "—"} />
          <Field label="Prevoženo" value={nalog.actualDistanceKm !== null ? `${nalog.actualDistanceKm} km` : "—"} />
          <Field label="Dnevnica" value={nalog.dailyAllowanceEur !== null ? `${nalog.dailyAllowanceEur} EUR` : "—"} />
          <Field label="Drugi stroški" value={nalog.otherCostsEur !== null ? `${nalog.otherCostsEur} EUR — ${nalog.otherCostsNote ?? ""}` : "—"} />
          <Field label="Opomba" value={nalog.note ?? "—"} />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-8 pt-8">
        <div className="text-center">
          <div className="border-t border-gray-900 pt-1 text-xs text-gray-600">
            Podpis voznika {nalog.driverSignedAt ? `(${fmtDate(nalog.driverSignedAt)})` : ""}
          </div>
        </div>
        <div className="text-center">
          <div className="border-t border-gray-900 pt-1 text-xs text-gray-600">
            Podpis odredbodajalca / likvidacija {nalog.approverSignedAt ? `(${fmtDate(nalog.approverSignedAt)})` : ""}
          </div>
        </div>
      </section>
    </div>
  );
}
