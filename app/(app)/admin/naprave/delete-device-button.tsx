"use client";

import { useTransition } from "react";
import { deleteDevice } from "./actions";

export function DeleteDeviceButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("Izbrišem to napravo? Odjavljena bo tudi iz Traccarja.")) {
          startTransition(() => deleteDevice(id));
        }
      }}
      className="text-sm text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
    >
      Izbriši
    </button>
  );
}
