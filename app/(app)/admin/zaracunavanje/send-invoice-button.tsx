"use client";

import { useState, useTransition } from "react";
import { sendCurrentInvoice } from "./actions";

// Naslov(-i) se vpišejo tu, sproti, ob vsakem ročnem pošiljanju posebej -- NAMENOMA ločeno od
// Tenant.billingEmails (privzeti naslovi podjetja v zavihku Podjetja, uporabljeni samo za mesečni
// samodejni tek), da ročno pošiljanje ne vpliva na in ni vezano na privzeto konfiguracijo podjetja.
export function SendInvoiceButton({
  tenantId,
  currentPeriodLabel,
}: {
  tenantId: string;
  currentPeriodLabel: string;
}) {
  const [to, setTo] = useState("");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  function handleSend() {
    setMessage(null);
    startTransition(async () => {
      const result = await sendCurrentInvoice(tenantId, to);
      setIsError(Boolean(result.error));
      setMessage(result.error ?? result.success ?? null);
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-gray-200 p-4 dark:border-gray-700">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Pošlji račun na e-pošto (lahko več, ločenih z vejico)
        <input
          type="text"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="prejemnik@primer.si"
          className="mt-1 w-72 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </label>
      <button
        type="button"
        onClick={handleSend}
        disabled={isPending || to.trim().length === 0}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Pošiljam …" : `Pošlji — ${currentPeriodLabel}`}
      </button>
      {message && (
        <span className={`text-sm ${isError ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
          {message}
        </span>
      )}
    </div>
  );
}
