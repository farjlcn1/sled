"use client";

import { useActionState, useState } from "react";
import { completePotniNalog, suggestFromGps } from "./actions";
import type { GpsSuggestion } from "@/lib/potni-nalog";
import { SlovenianDateInput } from "@/components/date-input";

const inputClass =
  "mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CompleteDialog({
  nalogId,
  plannedDepartureAt,
  plannedReturnAt,
}: {
  nalogId: string;
  plannedDepartureAt: string;
  plannedReturnAt: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(completePotniNalog, undefined);
  const [suggestion, setSuggestion] = useState<GpsSuggestion>(null);
  const [suggestState, setSuggestState] = useState<"idle" | "loading" | "error" | "done">("idle");

  async function handleSuggest() {
    setSuggestState("loading");
    try {
      const result = await suggestFromGps(nalogId);
      setSuggestion(result);
      setSuggestState(result ? "done" : "error");
    } catch {
      setSuggestState("error");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 dark:border-gray-600 dark:text-gray-300"
      >
        Zaključi
      </button>

      {open && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <form
            action={formAction}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-md border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900"
          >
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Zaključek potnega naloga — dejanski podatki</h3>
            <input type="hidden" name="id" value={nalogId} />

            <button
              type="button"
              onClick={handleSuggest}
              disabled={suggestState === "loading"}
              className="rounded-md border border-blue-300 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950"
            >
              {suggestState === "loading" ? "Iščem v GPS podatkih …" : "Predlagaj iz GPS"}
            </button>
            {suggestState === "error" && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Ni bilo mogoče najti GPS podatkov za to obdobje — vnesi podatke ročno.
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Dejanski odhod</label>
                <SlovenianDateInput
                  name="actualDepartureAt"
                  withTime
                  required
                  defaultValue={toLocalInput(suggestion?.actualDepartureAt ?? plannedDepartureAt)}
                  key={`dep-${suggestion?.actualDepartureAt ?? ""}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Dejanska vrnitev</label>
                <SlovenianDateInput
                  name="actualReturnAt"
                  withTime
                  required
                  defaultValue={toLocalInput(suggestion?.actualReturnAt ?? plannedReturnAt)}
                  key={`ret-${suggestion?.actualReturnAt ?? ""}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Stanje števca — začetek (km)</label>
                <input
                  type="number"
                  step="0.1"
                  name="startOdometerKm"
                  defaultValue={suggestion?.startOdometerKm ?? ""}
                  key={`start-${suggestion?.startOdometerKm ?? ""}`}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Stanje števca — konec (km)</label>
                <input
                  type="number"
                  step="0.1"
                  name="endOdometerKm"
                  defaultValue={suggestion?.endOdometerKm ?? ""}
                  key={`end-${suggestion?.endOdometerKm ?? ""}`}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Prevoženo (km)</label>
                <input
                  type="number"
                  step="0.1"
                  name="actualDistanceKm"
                  defaultValue={suggestion?.actualDistanceKm ?? ""}
                  key={`dist-${suggestion?.actualDistanceKm ?? ""}`}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Dnevnica (EUR)</label>
                <input type="number" step="0.01" name="dailyAllowanceEur" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Drugi stroški skupaj (EUR)</label>
                <input type="number" step="0.01" name="otherCostsEur" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Drugi stroški — opomba</label>
                <input name="otherCostsNote" placeholder="cestnina, parkirnina, nočitev …" className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Opomba</label>
                <input name="note" className={inputClass} />
              </div>
            </div>

            {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
            {state?.success && <p className="text-sm text-green-700 dark:text-green-400">Shranjeno.</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300"
              >
                Zapri
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {pending ? "Shranjujem …" : "Shrani"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
