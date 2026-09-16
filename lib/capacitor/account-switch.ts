export type SavedAccount = { id: string; label: string };

// Privzeto varno ozadje: dokler v sled-android ni nameščen pravi Capacitor most
// (AccountCookiePlugin + @capacitor/core/preferences, glej sled-android repo), ta modul tiho ne
// naredi nič -- v navadnem namizju/brskalniku Menu preprosto ne prikaže sekcije z računi namesto
// da bi počil. Zamenjano s pravo implementacijo, ko je native stran pripravljena.
export function isAccountSwitchAvailable(): boolean {
  return false;
}

export async function listSavedAccounts(): Promise<SavedAccount[]> {
  return [];
}

export async function saveCurrentAccount(_email: string): Promise<void> {}

export async function switchToAccount(_id: string): Promise<void> {}

export async function removeAccount(_id: string): Promise<void> {}

export async function addNewAccount(): Promise<void> {
  window.location.href = "/login?from=" + encodeURIComponent("/mobilna");
}
