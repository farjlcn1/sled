import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { AccountCookie } from "./account-cookie-plugin";

export type SavedAccount = { id: string; label: string };

type StoredAccount = SavedAccount & { token: string; savedAt: string };

const STORAGE_KEY = "sledenje_accounts";

// Capacitor.isNativePlatform() je deterministično false med SSR (ni mostu na strežniku) in šele
// po hidraciji znotraj prave Android lupine postane true -- klicatelj (mobile-account-switcher.tsx)
// to preverja v useEffectu, ne v render telesu, da se izogne hydration mismatchu.
export function isAccountSwitchAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

async function readStored(): Promise<StoredAccount[]> {
  try {
    const { value } = await Preferences.get({ key: STORAGE_KEY });
    if (!value) return [];
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeStored(accounts: StoredAccount[]): Promise<void> {
  await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(accounts) });
}

export async function listSavedAccounts(): Promise<SavedAccount[]> {
  const accounts = await readStored();
  return accounts.map(({ id, label }) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
}

// Kliče se ob vsakem odprtju Menu zavihka (glej mobile-account-switcher.tsx) -- upsert po id, da
// sveža prijava istega e-poštnega naslova posodobi shranjeni žeton namesto podvojenega vnosa.
export async function saveCurrentAccount(email: string): Promise<void> {
  const { value: token } = await AccountCookie.getSessionCookie();
  if (!token) return;
  const id = email.toLowerCase();
  const accounts = await readStored();
  const next = accounts.filter((a) => a.id !== id);
  next.push({ id, label: id, token, savedAt: new Date().toISOString() });
  await writeStored(next);
}

// Samo zamenja piškotek -- osvežitev strani (da se seja dejansko uporabi) je odgovornost
// klicatelja (glej mobile-account-switcher.tsx), ne te funkcije.
export async function switchToAccount(id: string): Promise<void> {
  const accounts = await readStored();
  const entry = accounts.find((a) => a.id === id);
  if (!entry) return;
  await AccountCookie.setSessionCookie({ value: entry.token });
}

// Namerno ne dotakne žive seje, tudi če je odstranjen ravno trenutno aktivni račun -- ta ostane
// prijavljen do običajne odjave/preklopa, samo izgine iz shranjenega seznama.
export async function removeAccount(id: string): Promise<void> {
  const accounts = await readStored();
  await writeStored(accounts.filter((a) => a.id !== id));
}

export async function addNewAccount(): Promise<void> {
  await AccountCookie.clearSessionCookie();
  // Ne gol "/login" -- requireUser() preusmeri tja brez "from", kar bi po prijavi pristalo na
  // namizni "/" namesto nazaj v mobilno lupino (glej app/login/actions.ts redirectTo obravnavo).
  window.location.href = "/login?from=" + encodeURIComponent("/mobilna");
}
