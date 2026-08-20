"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { VehicleMap, type HistoryRoute } from "@/components/vehicle-map";
import { SlovenianDateInput } from "@/components/date-input";
import type { VehicleIcon } from "@/app/api/pozicije/route";
import type { HistoryRow } from "@/lib/history-data";
import type { VehicleStatus } from "@/lib/vehicle-status";
import { VehicleRow } from "./vehicle-row";
import { GroupRow } from "./group-row";
import { VehicleHistoryTable } from "./vehicle-history-table";
import { TodaySummaryPanel } from "./today-summary-panel";

// Mora ustrezati VehicleMap-ovi lastni (trenutno fiksni) višini spodaj, da se stranski
// seznam navidezno "razteza" na enako višino kot zemljevid, ko je vozil dovolj za scroll.
const SIDEBAR_MAX_HEIGHT = "max(75vh, 520px)";

export type VehicleListItem = {
  id: string;
  plate: string;
  brandModel: string;
  driverName: string | null;
  icon: VehicleIcon;
  year: number | null;
  registrationDate: string | null;
  nextServiceDate: string | null;
  note: string | null;
  deviceId: string | null;
};

export type GroupItem = {
  id: string;
  name: string;
  vehicleIds: string[];
};

export type SelectionData = {
  vehicleId: string;
  plate: string;
  icon: VehicleIcon;
  brandModel: string;
  year: number | null;
  driverName: string | null;
  registrationDate: string | null;
  nextServiceDate: string | null;
  note: string | null;
  status: VehicleStatus;
  rows: HistoryRow[];
  error: string | null;
  from: string;
  to: string;
};

type ContextMenuTarget =
  | { type: "vehicle"; vehicleId: string }
  | { type: "group"; groupId: string };

// d.toISOString() vrne UTC datum, d.setDate/getDate pa delata v lokalnem času -- v Ljubljani
// (UTC+2) lokalna polnoč pade na 22:00 UTC PREJŠNJEGA dne, zato bi toISOString().slice(0,10) tu
// vrnil dan prej kot je dejansko mišljeno. Za "lokalni koledarski dan" sestavimo niz iz lokalnih
// komponent, ne iz UTC.
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return `${localDateStr(d)}T00:00`;
}

function defaultTo() {
  return `${localDateStr(new Date())}T23:59`;
}

function tabClass(active: boolean) {
  return active
    ? "flex-1 border-b-2 border-blue-600 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400"
    : "flex-1 border-b-2 border-transparent px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200";
}

export function VehiclesPanel({
  vehicles,
  groups,
  selectedVehicleIds = [],
  selections,
  initialVisibleFields,
}: {
  vehicles: VehicleListItem[];
  groups: GroupItem[];
  selectedVehicleIds?: string[];
  selections: SelectionData[];
  initialVisibleFields: string[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"vozila" | "skupine">("vozila");
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(() => new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; target: ContextMenuTarget } | null>(null);
  const [dialogTarget, setDialogTarget] = useState<{ ids: string[]; label: string } | null>(null);
  const [pointSelection, setPointSelection] = useState<Record<string, Set<number>>>({});
  // Zadnje kliknjeno (odkljukano) vozilo -- zanj prikažemo "Danes" podokno desno od zemljevida.
  const [focusedVehicleId, setFocusedVehicleId] = useState<string | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    function close() {
      setContextMenu(null);
    }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [contextMenu]);

  // Klik, ki vozilo odkljuka (prikaže na zemljevidu), spodaj takoj naloži tudi njegovo zadnjo
  // zgodovino/pozicijo -- brez odkljukanja/vozila ni treba posebej odpirati dialoga "Naloži zgodovino".
  function quickLoadHistory(vehicleId: string) {
    router.push(`/zemljevid?vozilo=${vehicleId}&from=${defaultFrom()}&to=${defaultTo()}`);
  }

  function toggleChecked(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        quickLoadHistory(id);
        setFocusedVehicleId(id);
      }
      return next;
    });
  }

  // Klik-in-vlečenje čez vozila v seznamu zajame vsa vozila med začetno in trenutno vrstico
  // (ne glede na trenutni zavihek Vozila/Skupine) -- ne prikaže/naloži ničesar samodejno kot
  // navaden klik, samo jih odkljuka, da je nato mogoče desni klik -> "Naloži zgodovino za N vozil".
  // Razlika med "navaden klik" in "vlečenje" ni v Ctrlu, ampak v premiku: dokler miška ne vstopi
  // v DRUGO vrstico, gre za navaden klik (glej dragMovedRef/wasDragged spodaj).
  const dragAnchorIdRef = useRef<string | null>(null);
  const dragSnapshotRef = useRef<Set<string>>(new Set());
  const draggingRef = useRef(false);
  const dragMovedRef = useRef(false);

  function applyDragRange(currentId: string) {
    const anchorId = dragAnchorIdRef.current;
    if (!anchorId) return;
    const anchorIdx = vehicles.findIndex((v) => v.id === anchorId);
    const currentIdx = vehicles.findIndex((v) => v.id === currentId);
    if (anchorIdx === -1 || currentIdx === -1) return;
    const lo = Math.min(anchorIdx, currentIdx);
    const hi = Math.max(anchorIdx, currentIdx);
    const next = new Set(dragSnapshotRef.current);
    for (let i = lo; i <= hi; i++) next.add(vehicles[i].id);
    setCheckedIds(next);
  }

  function handleDragStart(vehicleId: string) {
    draggingRef.current = true;
    dragMovedRef.current = false;
    dragAnchorIdRef.current = vehicleId;
    dragSnapshotRef.current = new Set(checkedIds);
  }

  function handleDragEnter(vehicleId: string) {
    if (!draggingRef.current) return;
    if (vehicleId !== dragAnchorIdRef.current) dragMovedRef.current = true;
    if (dragMovedRef.current) applyDragRange(vehicleId);
  }

  // Kliče ga vrstica sama ob kliku, da ugotovi, ali je šlo za pravo vlečenje (in naj torej
  // preskoči svoj navaden preklop/razširitev) -- takoj počisti zastavico za naslednjo kretnjo.
  function consumeDragMoved(): boolean {
    const moved = dragMovedRef.current;
    dragMovedRef.current = false;
    return moved;
  }

  useEffect(() => {
    function stopDragging() {
      draggingRef.current = false;
    }
    window.addEventListener("mouseup", stopDragging);
    return () => window.removeEventListener("mouseup", stopDragging);
  }, []);

  const allChecked = vehicles.length > 0 && vehicles.every((v) => checkedIds.has(v.id));

  function toggleAll() {
    setCheckedIds(allChecked ? new Set() : new Set(vehicles.map((v) => v.id)));
  }

  function toggleGroupExpanded(groupId: string) {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function openHistoryDialogForIds(ids: string[], label: string) {
    setDialogTarget({ ids, label });
  }

  // Vec izbranih (pozelenih) vozil + desni klik na eno od njih -> zgodovina za vsa izbrana.
  // Desni klik na neizbrano vozilo deluje kot prej -> zgodovina samo za to vozilo.
  // Desni klik na skupino -> zgodovina za vsa vozila v tej skupini, ne glede na kljukice.
  function handleContextMenuAction() {
    if (!contextMenu) return;
    const { target } = contextMenu;
    setContextMenu(null);

    if (target.type === "group") {
      const group = groups.find((g) => g.id === target.groupId);
      if (!group) return;
      openHistoryDialogForIds(group.vehicleIds, `skupino "${group.name}"`);
      return;
    }

    const { vehicleId } = target;
    if (checkedIds.has(vehicleId) && checkedIds.size > 1) {
      openHistoryDialogForIds(Array.from(checkedIds), `${checkedIds.size} izbranih vozil`);
    } else {
      const vehicle = vehicles.find((v) => v.id === vehicleId);
      openHistoryDialogForIds([vehicleId], vehicle?.plate ?? vehicleId);
    }
  }

  function handleDialogSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dialogTarget) return;
    const formData = new FormData(e.currentTarget);
    const from = formData.get("from") as string;
    const to = formData.get("to") as string;
    const ids = dialogTarget.ids;
    setDialogTarget(null);
    router.push(`/zemljevid?vozilo=${ids.join(",")}&from=${from}&to=${to}`);
  }

  const menuLabel = (() => {
    if (!contextMenu) return "";
    const { target } = contextMenu;
    if (target.type === "group") {
      const group = groups.find((g) => g.id === target.groupId);
      return `Naloži zgodovino za skupino${group ? ` "${group.name}"` : ""}`;
    }
    const isMulti = checkedIds.has(target.vehicleId) && checkedIds.size > 1;
    return isMulti ? `Naloži zgodovino za ${checkedIds.size} izbranih vozil` : "Naloži zgodovino";
  })();

  const historyRoutes: HistoryRoute[] = selections
    .filter((s) => !s.error && s.rows.length > 0)
    .map((s) => ({
      path: s.rows.map((r) => [r.longitude as number, r.latitude as number] as [number, number]),
      vehicleId: s.vehicleId,
      plate: s.plate,
      icon: s.icon,
      status: s.status,
    }));

  // Shift+vlečenje po narisani poti na zemljevidu (glej VehicleMap) -- zamenja izbiro tega
  // vozila z zajetimi indeksi, enako kot bi jih izbral z vlečenjem po tabeli spodaj.
  function handleMapDragSelect(results: { vehicleId: string; indices: number[] }[]) {
    setPointSelection((prev) => {
      const next = { ...prev };
      for (const r of results) next[r.vehicleId] = new Set(r.indices);
      return next;
    });
  }

  // Izbrane vrstice v tabeli zgodovine -> pobarvane tocke/segment na zemljevidu, vedno v kronoloskem
  // vrstnem redu (ne v trenutnem prikaznem sortiranju tabele), da je pot smiselna ne glede na sort.
  const highlightPaths: [number, number][][] = selections
    .map((s) => {
      const selected = pointSelection[s.vehicleId];
      if (!selected || selected.size === 0) return [];
      return Array.from(selected)
        .map((i) => s.rows[i])
        .filter((r): r is HistoryRow => Boolean(r))
        .sort((a, b) => a.fixTime.localeCompare(b.fixTime))
        .map((r) => [r.longitude as number, r.latitude as number] as [number, number]);
    })
    .filter((path) => path.length > 0);

  const vehiclesById = new Map(vehicles.map((v) => [v.id, v]));
  const focusedVehicle = focusedVehicleId ? (vehiclesById.get(focusedVehicleId) ?? null) : null;

  return (
    <div className="space-y-6 pb-24">
      <div
        className={`grid grid-cols-1 gap-4 ${focusedVehicle ? "lg:grid-cols-[360px_minmax(0,1fr)_300px]" : "lg:grid-cols-[360px_minmax(0,1fr)]"}`}
      >
        <div
          className="relative self-start overflow-x-auto overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700"
          style={{ maxHeight: SIDEBAR_MAX_HEIGHT }}
        >
          <div className="sticky top-0 z-10 flex border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            <button type="button" onClick={() => setActiveTab("vozila")} className={tabClass(activeTab === "vozila")}>
              Vozila
            </button>
            <button type="button" onClick={() => setActiveTab("skupine")} className={tabClass(activeTab === "skupine")}>
              Skupine
            </button>
          </div>

          <>
            {activeTab === "vozila" ? (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="w-8 px-3 py-2">
                      <div
                        onClick={toggleAll}
                        role="checkbox"
                        aria-checked={allChecked}
                        aria-label="Izberi vsa vozila na zemljevidu"
                        title="Izberi/odkljukaj vsa vozila"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleAll();
                          }
                        }}
                        className={
                          allChecked
                            ? "h-5 w-5 cursor-pointer rounded border border-green-500 bg-green-200 dark:border-green-500 dark:bg-green-800"
                            : "h-5 w-5 cursor-pointer rounded border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800"
                        }
                      />
                    </th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {vehicles.map((v) => (
                    <VehicleRow
                      key={v.id}
                      vehicleId={v.id}
                      plate={v.plate}
                      brandModel={v.brandModel}
                      driverName={v.driverName}
                      year={v.year}
                      registrationDate={v.registrationDate}
                      nextServiceDate={v.nextServiceDate}
                      note={v.note}
                      deviceId={v.deviceId}
                      icon={v.icon}
                      isSelected={selectedVehicleIds.includes(v.id)}
                      checked={checkedIds.has(v.id)}
                      onToggleChecked={() => toggleChecked(v.id)}
                      onDragStart={handleDragStart}
                      onDragEnter={handleDragEnter}
                      wasDragged={consumeDragMoved}
                      onContextMenu={(vehicleId, x, y) => setContextMenu({ target: { type: "vehicle", vehicleId }, x, y })}
                      onLoadHistory={(vehicleId, label) => openHistoryDialogForIds([vehicleId], label)}
                    />
                  ))}
                  {vehicles.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        Ni še vozil.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {groups.map((g) => {
                    const expanded = expandedGroupIds.has(g.id);
                    const members = g.vehicleIds.map((id) => vehiclesById.get(id)).filter((v): v is VehicleListItem => Boolean(v));
                    return (
                      <Fragment key={g.id}>
                        <GroupRow
                          groupId={g.id}
                          name={g.name}
                          vehicleCount={g.vehicleIds.length}
                          expanded={expanded}
                          onToggleExpand={() => toggleGroupExpanded(g.id)}
                          onContextMenu={(groupId, x, y) => setContextMenu({ target: { type: "group", groupId }, x, y })}
                        />
                        {expanded &&
                          (members.length > 0 ? (
                            members.map((v) => (
                              <VehicleRow
                                key={v.id}
                                vehicleId={v.id}
                                plate={v.plate}
                                brandModel={v.brandModel}
                                driverName={v.driverName}
                                year={v.year}
                                registrationDate={v.registrationDate}
                                nextServiceDate={v.nextServiceDate}
                                note={v.note}
                                deviceId={v.deviceId}
                                icon={v.icon}
                                isSelected={selectedVehicleIds.includes(v.id)}
                                checked={checkedIds.has(v.id)}
                                onToggleChecked={() => toggleChecked(v.id)}
                                onContextMenu={(vehicleId, x, y) =>
                                  setContextMenu({ target: { type: "vehicle", vehicleId }, x, y })
                                }
                                onLoadHistory={(vehicleId, label) => openHistoryDialogForIds([vehicleId], label)}
                              />
                            ))
                          ) : (
                            <tr key={`${g.id}-empty`}>
                              <td colSpan={2} className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                                Ni vozil v tej skupini.
                              </td>
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })}
                  {groups.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        Ni še skupin.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </>

          {contextMenu && (
            <div
              className="fixed z-20 rounded-md border border-gray-300 bg-white py-1 text-sm shadow-lg dark:border-gray-600 dark:bg-gray-800"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="block w-full whitespace-nowrap px-3 py-1.5 text-left text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={handleContextMenuAction}
              >
                {menuLabel}
              </button>
              {contextMenu.target.type === "vehicle" && (
                <button
                  type="button"
                  className="block w-full whitespace-nowrap px-3 py-1.5 text-left text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                  onClick={() => {
                    if (contextMenu.target.type !== "vehicle") return;
                    window.open(`/vozila/${contextMenu.target.vehicleId}`, "_blank", "noopener,noreferrer");
                    setContextMenu(null);
                  }}
                >
                  Vozilo
                </button>
              )}
            </div>
          )}

          {dialogTarget && (
            <div
              className="fixed inset-0 z-30 flex items-center justify-center bg-black/30"
              onClick={() => setDialogTarget(null)}
            >
              <form
                onClick={(e) => e.stopPropagation()}
                onSubmit={handleDialogSubmit}
                className="space-y-3 rounded-md border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900"
              >
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Zgodovina — {dialogTarget.label}</h3>
                <div className="flex gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Od</label>
                    <SlovenianDateInput name="from" withTime required defaultValue={defaultFrom()} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Do</label>
                    <SlovenianDateInput name="to" withTime required defaultValue={defaultTo()} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDialogTarget(null)}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300"
                  >
                    Prekliči
                  </button>
                  <button type="submit" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white">
                    Naloži
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        <VehicleMap
          visibleVehicleIds={checkedIds}
          historyRoutes={historyRoutes}
          highlightPaths={highlightPaths}
          onDragSelect={handleMapDragSelect}
        />

        {focusedVehicle && <TodaySummaryPanel vehicleId={focusedVehicle.id} plate={focusedVehicle.plate} />}
      </div>

      {selections.map((s) => (
        <div key={s.vehicleId} className="space-y-4 rounded-md border border-gray-200 p-4 dark:border-gray-700">
          {s.error ? (
            <>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{s.plate}</p>
              <p className="text-sm text-red-600 dark:text-red-400">{s.error}</p>
            </>
          ) : (
            <VehicleHistoryTable
              key={`${s.vehicleId}-${s.from}-${s.to}`}
              plate={s.plate}
              rows={s.rows}
              initialVisibleFields={initialVisibleFields}
              exportHref={`/api/zemljevid/izvoz?vozilo=${s.vehicleId}&from=${s.from}&to=${s.to}`}
              selectedIndices={pointSelection[s.vehicleId] ?? new Set()}
              onSelectedIndicesChange={(next) =>
                setPointSelection((prev) => ({ ...prev, [s.vehicleId]: next }))
              }
            />
          )}
        </div>
      ))}
    </div>
  );
}
