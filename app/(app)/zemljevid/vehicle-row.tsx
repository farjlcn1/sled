"use client";

import { useEffect, useState } from "react";
import type { VehicleQuickStatus } from "@/app/api/vozila/[id]/status/route";
import type { VehicleIcon } from "@/app/api/pozicije/route";
import { ICON_SVG } from "@/lib/vehicle-icons";
import { fetchJson, SessionExpiredError } from "@/lib/fetch-json";

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

const STATUS_LABEL: Record<VehicleQuickStatus["status"], string> = {
  driving: "Čas vožnje: ",
  idle: "Čas postanka: ",
  parked: "Čas postanka: ",
  unknown: "Čas v trenutnem stanju: ",
};

// Barva ikone vozila v seznamu: zelena (v vožnji) / oranžna (kontakt, miruje) / siva (brez
// kontakta, miruje ali podatek še ni na voljo) -- namenoma DRUGAČNA paleta kot na zemljevidu
// (STATUS_COLOR v vehicle-map.tsx uporablja rdečo za "parked"), ker bi rdeča čez cel dolg seznam
// mirujočih vozil delovala preveč alarmantno za majhno ikono v vrstici.
const STATUS_ICON_COLOR: Record<VehicleQuickStatus["status"], string> = {
  driving: "bg-green-500",
  idle: "bg-orange-500",
  parked: "bg-gray-400 dark:bg-gray-500",
  unknown: "bg-gray-400 dark:bg-gray-500",
};

function VehicleTypeIcon({ icon, status }: { icon: VehicleIcon; status: VehicleQuickStatus["status"] | null }) {
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${status ? STATUS_ICON_COLOR[status] : STATUS_ICON_COLOR.unknown}`}
      dangerouslySetInnerHTML={{ __html: ICON_SVG[icon] }}
    />
  );
}

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("sl-SI") : "—";
}

function FuelIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 shrink-0">
      <rect x="3" y="3" width="9" height="14" rx="1" />
      <path d="M5 7h5" strokeLinecap="round" />
      <path d="M12 7h2a1 1 0 0 1 1 1v6a1.5 1.5 0 0 0 3 0V9l-2-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OdometerIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 shrink-0">
      <path d="M3 14a7 7 0 1 1 14 0" strokeLinecap="round" />
      <path d="M10 14l3-4" strokeLinecap="round" />
      <circle cx="10" cy="14" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 shrink-0">
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function VehicleRow({
  vehicleId,
  plate,
  brandModel,
  driverName,
  year,
  registrationDate,
  nextServiceDate,
  note,
  deviceId,
  icon,
  isSelected,
  checked,
  onToggleChecked,
  onContextMenu,
  onLoadHistory,
  onDragStart,
  onDragEnter,
  wasDragged,
}: {
  vehicleId: string;
  plate: string;
  brandModel: string;
  driverName: string | null;
  year: number | null;
  registrationDate: string | null;
  nextServiceDate: string | null;
  note: string | null;
  deviceId: string | null;
  icon: VehicleIcon;
  isSelected: boolean;
  checked: boolean;
  onToggleChecked: () => void;
  onContextMenu: (vehicleId: string, x: number, y: number) => void;
  onLoadHistory: (vehicleId: string, label: string) => void;
  // Klik-in-vlečenje čez več vrstic zajame vsa vozila vmes (glej vehicles-panel.tsx) -- ločeno od
  // navadnega klika (brez premika), ki preklopi/razširi samo eno vozilo; wasDragged pove kateri
  // je bil ob dvigu miškinega gumba.
  onDragStart?: (vehicleId: string) => void;
  onDragEnter?: (vehicleId: string) => void;
  wasDragged?: () => boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<VehicleQuickStatus | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Naloži se enkrat ob izrisu vrstice (ne šele ob razširitvi) -- isti podatek zdaj barva tudi
  // ikono vozila v strnjenem stanju, ne samo polja v razširjenem podoknu.
  useEffect(() => {
    let cancelled = false;
    fetchJson<VehicleQuickStatus>(`/api/vozila/${vehicleId}/status`, { cache: "no-store" })
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setDetailError(err instanceof SessionExpiredError ? err.message : "Podatkov trenutno ni mogoče prikazati.");
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    onContextMenu(vehicleId, e.clientX, e.clientY);
  }

  function handleToggle() {
    onToggleChecked();
    setExpanded((v) => !v);
  }

  return (
    <tr
      onContextMenu={handleContextMenu}
      onMouseDown={(e) => {
        // preventDefault vedno -- brez tega brskalnik ob vlečenju začne označevati besedilo
        // (native selection), kar bi prevzelo miškine dogodke namesto range-select mehanizma spodaj.
        e.preventDefault();
        onDragStart?.(vehicleId);
      }}
      onMouseEnter={() => onDragEnter?.(vehicleId)}
      title="Klik za prikaz na zemljevidu in podatke o vozilu, desni klik za zgodovino vožnje, klik in vlečenje za izbiro več vozil"
      className={isSelected ? "bg-blue-50 dark:bg-blue-950" : undefined}
    >
      <td
        colSpan={2}
        onClick={() => {
          if (wasDragged?.()) return;
          handleToggle();
        }}
        role="checkbox"
        aria-checked={checked}
        aria-label={`Prikaži ${plate} na zemljevidu in podatke o vozilu`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleToggle();
          }
        }}
        className={[
          "cursor-pointer px-3 py-2 text-sm",
          checked ? "bg-green-100 dark:bg-green-900" : expanded ? "bg-blue-50/60 dark:bg-blue-950/40" : "",
          expanded ? "border-l-4 border-blue-500 dark:border-blue-400" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <VehicleTypeIcon icon={icon} status={detail?.status ?? null} />
            <div>
              <span
                className={
                  expanded
                    ? "text-base font-bold text-blue-700 dark:text-blue-400"
                    : "font-medium text-gray-900 dark:text-gray-100"
                }
              >
                {plate}
                {driverName && <span className="font-normal text-gray-500 dark:text-gray-400"> ({driverName})</span>}
              </span>
              <div
                className={expanded ? "text-sm text-blue-600 dark:text-blue-400" : "text-xs text-gray-500 dark:text-gray-400"}
              >
                {brandModel}
              </div>
            </div>
          </div>
          {expanded && (
            <div className="flex shrink-0 flex-col items-stretch gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onLoadHistory(vehicleId, plate);
                }}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium whitespace-nowrap text-white"
              >
                Naloži zgodovino
              </button>
              {deviceId ? (
                <a
                  href={`/admin/naprave/${deviceId}/surovi-podatki`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-center text-xs font-medium whitespace-nowrap text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Surovi podatki
                </a>
              ) : (
                <span
                  title="Vozilo nima povezane naprave."
                  className="rounded-md border border-gray-200 px-3 py-1.5 text-center text-xs font-medium whitespace-nowrap text-gray-400 dark:border-gray-700 dark:text-gray-600"
                >
                  Surovi podatki
                </span>
              )}
              <a
                href={`/vozila/${vehicleId}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-center text-xs font-medium whitespace-nowrap text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Vozilo
              </a>
            </div>
          )}
        </div>

        {expanded && (
          <div className="mt-2 space-y-1 text-xs">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Letnik: </span>
              <span className="text-gray-900 dark:text-gray-100">{year ?? "—"}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Voznik: </span>
              <span className="text-gray-900 dark:text-gray-100">{driverName ?? "—"}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Datum registracije: </span>
              <span className="text-gray-900 dark:text-gray-100">{fmtDate(registrationDate)}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Naslednji servis: </span>
              <span className="text-gray-900 dark:text-gray-100">{fmtDate(nextServiceDate)}</span>
            </div>
            {note && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Opomba: </span>
                <span className="text-gray-900 dark:text-gray-100">{note}</span>
              </div>
            )}

            {detailError && <p className="text-red-600 dark:text-red-400">{detailError}</p>}
            {!detail && !detailError && <p className="text-gray-500 dark:text-gray-400">Nalagam …</p>}
            {detail && (
              <>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Zadnja pozicija: </span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {new Date(detail.fixTime).toLocaleString("sl-SI", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {detail.naslov && ` — ${detail.naslov}`}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Ignition: </span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {detail.ignition === null ? "—" : detail.ignition ? "Da" : "Ne"}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {expanded && detail && (
          <div className="mt-2 flex items-center justify-around gap-2 border-t border-gray-200 pt-2 dark:border-gray-700">
            <div
              className="flex items-center gap-1 text-gray-700 dark:text-gray-300"
              title="Gorivo"
            >
              <FuelIcon />
              <span className="text-xs">{detail.fuel != null ? `${detail.fuel}%` : "—"}</span>
            </div>
            <div
              className="flex items-center gap-1 text-gray-700 dark:text-gray-300"
              title="Odometer"
            >
              <OdometerIcon />
              <span className="text-xs">{detail.odometer ?? "—"}</span>
            </div>
            <div
              className="flex items-center gap-1 text-gray-700 dark:text-gray-300"
              title={STATUS_LABEL[detail.status]}
            >
              <ClockIcon />
              <span className="text-xs">{formatDuration(detail.stateDurationMin)}</span>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}
