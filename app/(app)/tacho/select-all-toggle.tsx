"use client";

import { useTransition } from "react";

// Zdaj se izriše kot glava stolpca s kljukicami v tabeli (nad posamičnimi kljukicami vrstic), zato
// brez vidne besedilne oznake -- title/aria-label poskrbita za dostopnost.
export function SelectAllToggle({
  tenantId,
  action,
  allChecked,
  title,
}: {
  tenantId: string;
  action: (tenantId: string, checked: boolean) => Promise<void>;
  allChecked: boolean;
  title: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <input
      type="checkbox"
      title={title}
      aria-label={title}
      defaultChecked={allChecked}
      disabled={pending}
      onChange={(e) => startTransition(() => action(tenantId, e.target.checked))}
    />
  );
}
