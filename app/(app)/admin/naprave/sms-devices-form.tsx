"use client";

import { useState, useTransition } from "react";
import { sendDeviceSms } from "./actions";

export type SmsDevice = {
  id: string;
  imei: string;
  simNumber: string | null;
};

function fieldClass() {
  return "mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
}

export function SmsDevicesForm({
  devices,
  onClose,
  onSent,
}: {
  devices: SmsDevice[];
  onClose: () => void;
  onSent: (count: number) => void;
}) {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSend() {
    const count = devices.length;
    const ok = window.confirm(`Ali res želiš poslati SMS na ${count} SIM številk?`);
    if (!ok) return;

    startTransition(async () => {
      const result = await sendDeviceSms(devices.map((d) => d.id), message);
      onSent(result.sent);
    });
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg space-y-3 rounded-md border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900"
      >
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Pošlji SMS</h3>

        <ul className="max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 text-sm text-gray-700 dark:text-gray-300">
          {devices.map((d) => (
            <li key={d.id}>
              {d.simNumber ?? (
                <span className="text-red-600 dark:text-red-400">IMEI {d.imei} — ni SIM številke</span>
              )}
            </li>
          ))}
        </ul>

        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Sporočilo
          <textarea
            name="message"
            required
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className={fieldClass()}
          />
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300"
          >
            Prekliči
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isPending || message.trim().length === 0}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPending ? "Pošiljam …" : "Pošlji"}
          </button>
        </div>
      </div>
    </div>
  );
}
