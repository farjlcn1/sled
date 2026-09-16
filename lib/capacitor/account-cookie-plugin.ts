import { registerPlugin } from "@capacitor/core";

// Ime "AccountCookie" mora natancno ustrezati @CapacitorPlugin(name = "AccountCookie") na
// nativni Android strani (sled-android repo, AccountCookiePlugin.java) -- primerjava je
// obcutljiva na velike/male crke. Ta modul obstaja samo znotraj Capacitor lupine; v navadnem
// brskalniku ta vtičnik ni registriran, zato ga sme klicati samo koda, ki je prej preverila
// Capacitor.isNativePlatform() (glej account-switch.ts).
export interface AccountCookiePlugin {
  getSessionCookie(): Promise<{ value: string | null }>;
  setSessionCookie(options: { value: string }): Promise<void>;
  clearSessionCookie(): Promise<void>;
}

export const AccountCookie = registerPlugin<AccountCookiePlugin>("AccountCookie");
