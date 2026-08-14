"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SlovenianDateInput } from "@/components/date-input";
import { createReservation, deleteReservation, type ReservationState } from "./actions";

const PALETTE = [
  "#2563eb", "#9333ea", "#0d9488", "#db2777", "#d97706",
  "#4338ca", "#0891b2", "#e11d48", "#65a30d", "#c026d3",
];
const DAY_LABELS = ["Pon", "Tor", "Sre", "Čet", "Pet", "Sob", "Ned"];
const PX_PER_HOUR = 40;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// d.toISOString() vrne UTC datum, d.setDate/getDate pa delata v lokalnem času -- v Ljubljani
// (UTC+2) lokalna polnoč pade na 22:00 UTC PREJŠNJEGA dne, zato bi toISOString().slice(0,10) tu
// vrnil dan prej kot smo ga dejansko izbrali. Za "lokalni koledarski dan" moramo sestaviti niz iz
// lokalnih komponent, ne iz UTC.
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type ReservationItem = {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  driverName: string | null;
  routeName: string;
  startAt: string;
  endAt: string;
};

type PositionedReservation = ReservationItem & { lane: number; laneCount: number };

// Prekrivajoce se rezervacije istega dne razporedi v "steze" (kot Outlook/Google Calendar dnevni
// pogled), da se vizualno ne prekrivajo -- pohlepni algoritem: vsaka rezervacija gre v prvo prosto
// stezo, katere zadnja rezervacija se je ze koncala.
function packReservationsForDay(dayReservations: ReservationItem[]): PositionedReservation[] {
  const sorted = [...dayReservations].sort((a, b) => a.startAt.localeCompare(b.startAt));
  const laneEndTimes: string[] = [];
  const placed: (ReservationItem & { lane: number })[] = [];

  for (const r of sorted) {
    let laneIndex = laneEndTimes.findIndex((endAt) => endAt <= r.startAt);
    if (laneIndex === -1) {
      laneIndex = laneEndTimes.length;
      laneEndTimes.push(r.endAt);
    } else {
      laneEndTimes[laneIndex] = r.endAt;
    }
    placed.push({ ...r, lane: laneIndex });
  }

  return placed.map((r) => {
    const overlapping = placed.filter((other) => other.startAt < r.endAt && other.endAt > r.startAt);
    const laneCount = Math.max(...overlapping.map((o) => o.lane + 1), r.lane + 1);
    return { ...r, laneCount };
  });
}

function fieldClass() {
  return "mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("sl-SI", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Vrednost "datetime-local" nima conske -- new Date(...) jo NA STRANI BRSKALNIKA pravilno tolmaci
// kot lokalni cas uporabnika. Strežnik teče v UTC, zato mora priti do njega ze pretvorjena v pravi
// UTC trenutek (namesto da bi streznik isti niz sam narobe tolmacil kot svoj lokalni UTC cas).
function localDateTimeToIso(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export function ReservationCalendar({
  weekStartIso,
  vehicles,
  drivers,
  reservations,
  canDelete,
}: {
  weekStartIso: string;
  vehicles: { id: string; plate: string }[];
  drivers: { id: string; fullName: string }[];
  reservations: ReservationItem[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const weekStart = new Date(weekStartIso);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [startAtIso, setStartAtIso] = useState("");
  const [endAtIso, setEndAtIso] = useState("");
  const [selected, setSelected] = useState<ReservationItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<ReservationState, FormData>(createReservation, undefined);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (state?.success) setModalOpen(false);
  }, [state]);

  function vehicleColor(vehicleId: string) {
    const idx = vehicles.findIndex((v) => v.id === vehicleId);
    return PALETTE[(idx < 0 ? 0 : idx) % PALETTE.length];
  }

  function goToWeek(offsetDays: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + offsetDays);
    const params = new URLSearchParams(window.location.search);
    params.set("teden", localDateStr(d));
    router.push(`/rezervacije?${params.toString()}`);
  }

  function goToday() {
    const params = new URLSearchParams(window.location.search);
    params.delete("teden");
    router.push(`/rezervacije?${params.toString()}`);
  }

  function handleDelete(id: string) {
    if (!window.confirm("Izbriši to rezervacijo?")) return;
    startTransition(async () => {
      const result = await deleteReservation(id);
      if (result?.error) {
        setDeleteError(result.error);
        return;
      }
      setSelected(null);
      setDeleteError(null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => goToWeek(-7)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            ‹ Prejšnji teden
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            Danes
          </button>
          <button
            type="button"
            onClick={() => goToWeek(7)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            Naslednji teden ›
          </button>
          <span className="ml-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            {days[0].toLocaleDateString("sl-SI", { day: "2-digit", month: "2-digit" })} –{" "}
            {days[6].toLocaleDateString("sl-SI", { day: "2-digit", month: "2-digit", year: "numeric" })}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setStartAtIso("");
            setEndAtIso("");
            setModalOpen(true);
          }}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          Rezerviraj vozilo
        </button>
      </div>

      {vehicles.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {vehicles.map((v) => (
            <span key={v.id} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: vehicleColor(v.id) }} />
              {v.plate}
            </span>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
          <div />
          {days.map((d, i) => (
            <div
              key={i}
              className="border-l border-gray-200 px-2 py-2 text-center text-xs font-medium text-gray-600 dark:border-gray-700 dark:text-gray-300"
            >
              {DAY_LABELS[i]} <span className="text-gray-400 dark:text-gray-500">{d.getDate()}.{d.getMonth() + 1}.</span>
            </div>
          ))}
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          <div className="relative grid grid-cols-[56px_repeat(7,1fr)]" style={{ height: HOURS.length * PX_PER_HOUR }}>
            <div className="relative">
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute right-1 -translate-y-1/2 text-[10px] text-gray-400 dark:text-gray-500"
                  style={{ top: h * PX_PER_HOUR }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>
            {days.map((day, dayIdx) => {
              const dayStart = new Date(day);
              dayStart.setHours(0, 0, 0, 0);
              const dayEnd = new Date(dayStart);
              dayEnd.setDate(dayEnd.getDate() + 1);
              const dayReservations = reservations.filter(
                (r) => new Date(r.startAt) < dayEnd && new Date(r.endAt) > dayStart
              );
              const positioned = packReservationsForDay(dayReservations);
              return (
                <div key={dayIdx} className="relative border-l border-gray-100 dark:border-gray-800">
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      className="absolute left-0 right-0 border-t border-gray-100 dark:border-gray-800"
                      style={{ top: h * PX_PER_HOUR }}
                    />
                  ))}
                  {positioned.map((r) => {
                    const clampedStart = Math.max(new Date(r.startAt).getTime(), dayStart.getTime());
                    const clampedEnd = Math.min(new Date(r.endAt).getTime(), dayEnd.getTime());
                    const topHours = (clampedStart - dayStart.getTime()) / 3_600_000;
                    const durationHours = Math.max((clampedEnd - clampedStart) / 3_600_000, 0.25);
                    const widthPct = 100 / r.laneCount;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelected(r)}
                        className="absolute overflow-hidden rounded px-1 py-0.5 text-left text-[11px] leading-tight text-white shadow-sm"
                        style={{
                          top: topHours * PX_PER_HOUR,
                          height: durationHours * PX_PER_HOUR - 2,
                          left: `${r.lane * widthPct}%`,
                          width: `calc(${widthPct}% - 2px)`,
                          backgroundColor: vehicleColor(r.vehicleId),
                        }}
                        title={`${r.vehiclePlate} — ${r.routeName}`}
                      >
                        <div className="truncate font-semibold">{r.vehiclePlate}</div>
                        <div className="truncate">{r.routeName}</div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30" onClick={() => setSelected(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm space-y-3 rounded-md border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900"
          >
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {selected.vehiclePlate} — {selected.routeName}
            </h3>
            <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <div>Od: {fmtDateTime(selected.startAt)}</div>
              <div>Do: {fmtDateTime(selected.endAt)}</div>
              <div>Voznik: {selected.driverName ?? "—"}</div>
            </div>
            {deleteError && <p className="text-sm text-red-600 dark:text-red-400">{deleteError}</p>}
            <div className="flex justify-end gap-2">
              {canDelete && (
                <button
                  type="button"
                  onClick={() => handleDelete(selected.id)}
                  className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-800 dark:text-red-400"
                >
                  Izbriši
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setDeleteError(null);
                }}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
              >
                Zapri
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30" onClick={() => setModalOpen(false)}>
          <form
            action={formAction}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-3 rounded-md border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900"
          >
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Rezerviraj vozilo</h3>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Vozilo
              <select name="vehicleId" required defaultValue="" className={fieldClass()}>
                <option value="" disabled>
                  — izberi vozilo —
                </option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Voznik (neobvezno)
              <select name="driverId" defaultValue="" className={fieldClass()}>
                <option value="">— brez voznika —</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Ime poti
              <input name="routeName" required placeholder="npr. Ljubljana - Maribor" className={fieldClass()} />
            </label>
            <input type="hidden" name="startAt" value={startAtIso} />
            <input type="hidden" name="endAt" value={endAtIso} />
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Od
                <SlovenianDateInput
                  withTime
                  required
                  onValueChange={(v) => setStartAtIso(localDateTimeToIso(v))}
                />
              </label>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Do
                <SlovenianDateInput
                  withTime
                  required
                  onValueChange={(v) => setEndAtIso(localDateTimeToIso(v))}
                />
              </label>
            </div>
            {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
              >
                Prekliči
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {pending ? "Shranjujem …" : "Rezerviraj"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
