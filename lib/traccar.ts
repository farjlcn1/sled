import "server-only";

function authHeader(): string {
  const email = process.env.TRACCAR_SERVICE_EMAIL;
  const password = process.env.TRACCAR_SERVICE_PASSWORD;
  if (!email || !password) throw new Error("Traccar servisni račun ni nastavljen.");
  return "Basic " + Buffer.from(`${email}:${password}`).toString("base64");
}

function apiUrl(path: string): string {
  const base = process.env.TRACCAR_API_URL;
  if (!base) throw new Error("TRACCAR_API_URL ni nastavljen.");
  return `${base}${path}`;
}

async function traccarFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), {
    ...init,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
}

export type TraccarDevice = {
  id: number;
  name: string;
  uniqueId: string;
  status: string;
  lastUpdate: string | null;
  positionId: number;
};

export type TraccarPosition = {
  id: number;
  deviceId: number;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  fixTime: string;
  attributes: Record<string, unknown>;
};

// Registrira napravo v Traccarju, da bo sprejemal podatke od te IMEI.
// Klic je smiseln šele, ko je naprava dodana tudi v našo bazo.
export async function createTraccarDevice(imei: string, name: string): Promise<TraccarDevice> {
  const res = await traccarFetch("/api/devices", {
    method: "POST",
    body: JSON.stringify({ name, uniqueId: imei }),
  });
  if (!res.ok) {
    throw new Error(`Traccar: napaka pri dodajanju naprave (${res.status})`);
  }
  return res.json();
}

export async function deleteTraccarDevice(traccarDeviceId: number): Promise<void> {
  const res = await traccarFetch(`/api/devices/${traccarDeviceId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Traccar: napaka pri brisanju naprave (${res.status})`);
  }
}

// all=true je nujen -- Traccar brez njega (tudi administratorju) vrne samo naprave z izrecno
// pravico (tc_user_device), avtomatsko registrirane neznane naprave (glej lib/device-sync.ts) pa
// nimajo take pravice na nikogar, zato bi brez tega parametra ostale nevidne.
export async function getTraccarDevices(): Promise<TraccarDevice[]> {
  const res = await traccarFetch("/api/devices?all=true");
  if (!res.ok) throw new Error(`Traccar: napaka pri branju naprav (${res.status})`);
  return res.json();
}

// Traccarjev /api/positions brez parametrov ne vrne "vseh zadnjih pozicij" — deviceId je obvezen.
// Ponovljen parameter (deviceId=X&deviceId=Y) ali seznam (deviceId=X,Y) NE delujeta — Traccar
// upošteva samo prvega. Zato je treba klicati posebej za vsak deviceId.
export async function getTraccarPositions(deviceIds: number[]): Promise<TraccarPosition[]> {
  if (deviceIds.length === 0) return [];
  const results = await Promise.all(
    deviceIds.map(async (id) => {
      const res = await traccarFetch(`/api/positions?deviceId=${id}`);
      if (!res.ok) throw new Error(`Traccar: napaka pri branju pozicij (${res.status})`);
      return (await res.json()) as TraccarPosition[];
    })
  );
  return results.flat();
}

// Pošlje besedilni GPRS ukaz napravi prek OBSTOJEČE podatkovne povezave (textChannel: false) --
// NE prek SMS. Traccar temu pravi "custom" ukaz; za Teltonika naprave je to edini podprt tip
// ukaza (glej lib/device-command.ts za konkretne ukaze getver/getimeiccid in branje odgovora).
// Če naprava trenutno ni povezana, Traccar ukaz vrsti in ga dostavi ob naslednji povezavi.
export async function sendTraccarCommand(traccarDeviceId: number, data: string): Promise<void> {
  const res = await traccarFetch("/api/commands/send", {
    method: "POST",
    body: JSON.stringify({ id: 0, deviceId: traccarDeviceId, type: "custom", textChannel: false, attributes: { data } }),
  });
  if (!res.ok) throw new Error(`Traccar: napaka pri pošiljanju ukaza (${res.status})`);
}

// Polna zgodovina pozicij za izbrano vozilo v časovnem oknu — vir podatkov za poročila.
export async function getTraccarRoute(deviceId: number, from: Date, to: Date): Promise<TraccarPosition[]> {
  const params = new URLSearchParams({
    deviceId: String(deviceId),
    from: from.toISOString(),
    to: to.toISOString(),
  });
  const res = await traccarFetch(`/api/reports/route?${params}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Traccar: napaka pri branju zgodovine (${res.status})`);
  return res.json();
}
