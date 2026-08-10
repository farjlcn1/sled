import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { decode, summarizeDailyActivity, TachoDecodeError } from "@/lib/tacho/decode";
import { ACTIVITY_LABELS, EVENT_LABELS } from "@/lib/tacho/format";

function fmtDateTime(d: Date) {
  return d.toLocaleString("sl-SI", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function TachoPregledPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user.canManageUsers) {
    return <p className="text-sm text-gray-600 dark:text-gray-400">Nimaš dovoljenja za ogled tahografskih podatkov.</p>;
  }

  const { id } = await params;
  const file = await prisma.tachoFile.findUnique({
    where: { id },
    include: { vehicle: { select: { plate: true } }, driver: { select: { fullName: true } } },
  });
  if (!file) notFound();
  if (!user.canManagePlatform && file.tenantId !== user.tenantId) notFound();

  let data;
  try {
    data = decode(Buffer.from(file.rawData));
  } catch (e) {
    const message = e instanceof TachoDecodeError ? e.message : "Neznana napaka pri branju datoteke.";
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-medium text-gray-900 dark:text-gray-100">{file.fileName}</h1>
        <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium text-gray-900 dark:text-gray-100">{file.fileName}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {file.vehicle?.plate ?? file.driver?.fullName} · {(file.fileSize / 1024).toFixed(1)} KB
        </p>
      </div>

      {data.kind === "VOZNIK" ? (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400">Voznik</div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{data.fullName}</div>
            </div>
            <div className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400">Št. kartice</div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{data.idCode}</div>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Dnevni povzetek aktivnosti</h2>
            <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Datum</th>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Vožnja</th>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Delo</th>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Razpoložljivost</th>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Počitek</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {summarizeDailyActivity(data.activities).map((day) => (
                    <tr key={day.date}>
                      <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{day.date}</td>
                      <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{Math.round(day.drivingMin / 60 * 10) / 10} h</td>
                      <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{Math.round(day.workMin / 60 * 10) / 10} h</td>
                      <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                        {Math.round(day.availabilityMin / 60 * 10) / 10} h
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{Math.round(day.restMin / 60 * 10) / 10} h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Podroben potek aktivnosti ({data.activities.length})</h2>
            <div className="max-h-72 overflow-auto rounded-md border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Čas</th>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Aktivnost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {data.activities.map((a, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100">{fmtDateTime(a.time)}</td>
                      <td className="px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100">{ACTIVITY_LABELS[a.activityType]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">Registrska</div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{data.plate}</div>
          </div>
          <div className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">VIN</div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{data.vin}</div>
          </div>
          <div className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">Stanje števca ob prenosu</div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{data.odometerKm} km</div>
          </div>
          <div className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">Obdobje</div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {fmtDateTime(data.periodFrom)} – {fmtDateTime(data.periodTo)}
            </div>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Dogodki in napake ({data.events.length})</h2>
        <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Čas</th>
                <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Vrsta</th>
                <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Opis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data.events.map((e, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{fmtDateTime(e.time)}</td>
                  <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{EVENT_LABELS[e.eventType]}</td>
                  <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{e.description}</td>
                </tr>
              ))}
              {data.events.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    Ni zabeleženih dogodkov.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
