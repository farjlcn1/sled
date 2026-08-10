"use client";

import { useTransition } from "react";

export function ScheduleToggle({
  id,
  checked,
  action,
}: {
  id: string;
  checked: boolean;
  action: (id: string, checked: boolean) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <input
      type="checkbox"
      defaultChecked={checked}
      disabled={pending}
      onChange={(e) => startTransition(() => action(id, e.target.checked))}
    />
  );
}
