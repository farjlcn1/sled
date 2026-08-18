// Ob potekli seji nas proxy.ts preusmeri na /login -- fetch to preusmeritev tiho sledi in vrne
// HTML strani za prijavo namesto JSON-a. Brez preverjanja res.redirected bi klicoča koda
// dobila nerazumljivo napako pri razčlenjevanju JSON-a namesto jasnega razloga.
export class SessionExpiredError extends Error {}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.redirected) throw new SessionExpiredError("Seja je potekla. Osveži stran za ponovno prijavo.");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}
