"use client";

import { useState, useTransition } from "react";
import { sendCurrentInvoice } from "./actions";

export function SendInvoiceButton({
  tenantId,
  billingEmails,
  currentPeriodLabel,
}: {
  tenantId: string;
  billingEmails: string[];
  currentPeriodLabel: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  function handleSend() {
    setMessage(null);
    startTransition(async () => {
      const result = await sendCurrentInvoice(tenantId);
      setIsError(Boolean(result.error));
      setMessage(result.error ?? result.success ?? null);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-gray-200 p-4 dark:border-gray-700">
      <button
        type="button"
        onClick={handleSend}
        disabled={isPending}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Pošiljam …" : `Pošlji račun — ${currentPeriodLabel}`}
      </button>
      {billingEmails.length > 0 ? (
        <span className="text-sm text-gray-500 dark:text-gray-400">Na: {billingEmails.join(", ")}</span>
      ) : (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Ni nastavljenega e-poštnega naslova (uredi v zavihku Podjetja).
        </span>
      )}
      {message && (
        <span className={`text-sm ${isError ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
          {message}
        </span>
      )}
    </div>
  );
}
