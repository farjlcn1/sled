import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getRawDataForImei, type RawLogLine } from "@/lib/traccar-raw";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const KIND_LABEL: Record<RawLogLine["kind"], string> = {
  connected: "Povezava vzpostavljena",
  disconnected: "Povezava prekinjena",
  in: "Prejeto",
  out: "Poslano",
};

function kindClass(kind: RawLogLine["kind"]): string {
  if (kind === "in") return "shrink-0 text-blue-600 dark:text-blue-400";
  if (kind === "out") return "shrink-0 text-green-600 dark:text-green-400";
  return "shrink-0 text-gray-500 dark:text-gray-400";
}

function groupBySession(lines: RawLogLine[]): { sessionId: string; lines: RawLogLine[] }[] {
  const order: string[] = [];
  const map = new Map<string, RawLogLine[]>();
  for (const l of lines) {
    if (!map.has(l.sessionId)) {
      map.set(l.sessionId, []);
      order.push(l.sessionId);
    }
    map.get(l.sessionId)!.push(l);
  }
  // Najprej najnovejša seja -- to je tisto, kar nekoga, ki odpre to stran, običajno zanima.
  return order
    .slice()
    .reverse()
    .map((sessionId) => ({ sessionId, lines: map.get(sessionId)! }));
}

export default async function SuroviPodatkiPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const device = await prisma.device.findUnique({
    where: { id },
    select: { id: true, imei: true, tenantId: true, vehicle: { select: { plate: true } } },
  });
  if (!device) notFound();
  if (!user.canManagePlatform && device.tenantId !== user.tenantId) redirect("/");

  let lines: RawLogLine[] = [];
  let scannedBytes = 0;
  let error: string | null = null;
  try {
    const result = await getRawDataForImei(device.imei);
    lines = result.lines;
    scannedBytes = result.scannedBytes;
  } catch {
    error = "Dnevnika Traccar ni bilo mogoče prebrati.";
  }

  const sessions = groupBySession(lines);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Surovi podatki — {device.imei}
        {device.vehicle && (
          <span className="font-normal text-gray-500 dark:text-gray-400"> ({device.vehicle.plate})</span>
        )}
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Dobesedni bajti (hex), ki jih je naprava izmenjala s Traccar strežnikom — pregledanih zadnjih{" "}
        {fmtBytes(scannedBytes)} dnevnika.
      </p>

      <div className="mt-3">
        <a
          href={`/admin/naprave/${id}/surovi-podatki`}
          className="inline-block rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          Osveži
        </a>
      </div>

      {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!error && sessions.length === 0 && (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          V pregledanem delu dnevnika ni podatkov za to napravo. Naprava se morda še ni povezala s strežnikom, ali pa
          je zadnja povezava zunaj zajetega okna.
        </p>
      )}

      {!error && sessions.length > 0 && (
        <div className="mt-4 space-y-4 font-mono text-xs">
          {sessions.map((session) => (
            <div key={session.sessionId} className="rounded-md border border-gray-200 dark:border-gray-700">
              <div className="border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                Seja {session.sessionId}
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {session.lines.map((l, i) => (
                  <div key={i} className="flex flex-wrap gap-3 px-3 py-1.5">
                    <span className="shrink-0 text-gray-400 dark:text-gray-500">{l.timestamp}</span>
                    <span className={kindClass(l.kind)}>{KIND_LABEL[l.kind]}</span>
                    {l.hex && <span className="break-all text-gray-900 dark:text-gray-100">{l.hex}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
