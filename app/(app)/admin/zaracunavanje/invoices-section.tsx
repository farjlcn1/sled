"use client";

import { useState, useTransition } from "react";
import { generateCurrentInvoice } from "./actions";

export type InvoiceRow = {
  id: string;
  number: string;
  periodLabel: string;
  totalCents: number;
  sentAt: string | null;
};

export function InvoicesSection({
  tenantId,
  currentPeriodLabel,
  invoices,
}: {
  tenantId: string;
  currentPeriodLabel: string;
  invoices: InvoiceRow[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Samo ustvari/posodobi račun v spodnjem seznamu -- NE prenese ga samodejno (za to je "Prenesi"
  // pri vsakem računu posebej), da se generiranje in prenos ne mešata v en klik.
  function handleGenerate() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await generateCurrentInvoice(tenantId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage("Račun ustvarjen -- prenesi ga spodaj v seznamu.");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Računi</h2>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isPending}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {isPending ? "Pripravljam …" : `Ustvari račun — ${currentPeriodLabel}`}
        </button>
        {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
        {message && <span className="text-sm text-green-600 dark:text-green-400">{message}</span>}
      </div>

      <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Številka</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Obdobje</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Znesek</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Poslano</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">{inv.number}</td>
                <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{inv.periodLabel}</td>
                <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                  {(inv.totalCents / 100).toFixed(2)} €
                </td>
                <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                  {inv.sentAt ? new Date(inv.sentAt).toLocaleString("sl-SI") : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <a
                    href={`/api/racuni/${inv.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    Prenesi
                  </a>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  Ni še izdanih računov.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
