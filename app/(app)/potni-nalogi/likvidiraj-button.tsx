"use client";

import { useState } from "react";
import { likvidirajPotniNalog } from "./actions";

export function LikvidirajButton({ nalogId }: { nalogId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      await likvidirajPotniNalog(nalogId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Napaka.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-md border border-green-300 px-2 py-1 text-xs text-green-700 hover:bg-green-50 disabled:opacity-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950"
      >
        {pending ? "…" : "Likvidiraj"}
      </button>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
