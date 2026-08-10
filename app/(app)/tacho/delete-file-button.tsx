"use client";

import { useTransition } from "react";
import { deleteTachoFile } from "./actions";

export function DeleteFileButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("Izbriši to datoteko?")) startTransition(() => deleteTachoFile(id));
      }}
      className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
    >
      Izbriši
    </button>
  );
}
