import "server-only";
import { open, readdir, stat } from "node:fs/promises";
import path from "node:path";

const LOG_DIR = "/opt/traccar/logs";
const LOG_PATH = `${LOG_DIR}/tracker-server.log`;
// Prebere samo rep dnevnika -- dnevnik ob prometnem voznem parku raste neomejeno,
// zato branje celotne datoteke ob vsakem kliku ne bi bilo smiselno.
const TAIL_BYTES = 4 * 1024 * 1024;

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayStr(): string {
  return dateStr(new Date());
}

// Vsak koledarski dan med from in to (oba vključno), kot "YYYY-MM-DD" -- za branje
// dnevnika po dnevih rotiranih datotek za izbrano obdobje.
function daysInRange(from: string, to: string): string[] {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const cur = new Date(fy, fm - 1, fd);
  const end = new Date(ty, tm - 1, td);
  const days: string[] = [];
  while (cur <= end) {
    days.push(dateStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// Traccar dnevnik dnevno rotira (npr. tracker-server.log.20260810) -- za današnji dan
// je to kar trenutna, še rastoča datoteka, za pretekle dni pa poiščemo ustrezno rotirano.
// Vrne null, če za zahtevani dan ni (več) nobenega dnevnika.
async function resolveLogPath(date: string): Promise<string | null> {
  if (date === todayStr()) return LOG_PATH;

  const compact = date.replaceAll("-", "");
  const files = await readdir(LOG_DIR);
  const match = files.find((f) => f.includes(compact));
  return match ? path.join(LOG_DIR, match) : null;
}

export type RawLogLine = {
  timestamp: string;
  sessionId: string;
  kind: "connected" | "disconnected" | "in" | "out";
  protocol: string | null;
  remoteAddress: string | null;
  hex: string | null;
};

const HEX_LINE = /^(\S+ \S+)\s+INFO:\s+\[(\w+):\s*(\S+)\s+([<>])\s+([\d.]+)\]\s+([0-9a-fA-F]+)\s*$/;
// OsmAnd protokol (npr. testni/demo vozni park, ki pozicije pošilja prek preprostih HTTP GET
// zahtev namesto binarnega Teltonika zapisa) -- v dnevniku ni hex plačila, ampak berljiv URL,
// ki že sam vsebuje IMEI (?id=...), zato tu sploh ne rabimo dekodiranja "rokovanja" kot spodaj.
const OSMAND_LINE = /^(\S+ \S+)\s+INFO:\s+\[(\w+):\s*(\S+)\s+([<>])\s+([\d.]+)\]\s+(GET .+)$/;
const OSMAND_ID = /[?&]id=(\d+)/;
const BRACKET_LINE = /^(\S+ \S+)\s+INFO:\s+\[(\w+)\]\s+(.*)$/;
const ID_LINE = /^id:\s*(\d+),/;

// Teltonikin prvi paket seje je vedno IMEI prijava: 2 bajta dolžine + ASCII številke IMEI.
// Ko naprava pošlje neveljavne AVL podatke (ali seja nikoli ne pride do dekodirane pozicije,
// od koder bi sicer dobili "id: ..." vrstico), je to edini način, da sejo sploh povežemo z IMEI.
function decodeHandshakeImei(hex: string): string | null {
  if (hex.length < 4) return null;
  const declaredLen = parseInt(hex.slice(0, 4), 16);
  const rest = hex.slice(4);
  if (rest.length !== declaredLen * 2) return null;
  let ascii = "";
  for (let i = 0; i < rest.length; i += 2) {
    ascii += String.fromCharCode(parseInt(rest.slice(i, i + 2), 16));
  }
  return /^\d{10,17}$/.test(ascii) ? ascii : null;
}

async function readLogTail(logPath: string): Promise<string> {
  const stats = await stat(logPath);
  const start = Math.max(0, stats.size - TAIL_BYTES);
  const length = stats.size - start;
  const handle = await open(logPath, "r");
  try {
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, start);
    const text = buffer.toString("utf-8");
    // Če nismo začeli na začetku datoteke, je prva vrstica lahko prirezana na sredini -- zavrzi jo.
    return start > 0 ? text.slice(text.indexOf("\n") + 1) : text;
  } finally {
    await handle.close();
  }
}

type ParsedLine = RawLogLine & {
  // OsmAnd je brezstanjski HTTP -- Traccar isto "sejo" (npr. eno keep-alive povezavo) v praksi
  // deli med VEČ napravami hkrati, zato seja->IMEI ni 1:1 kot pri Teltonikinem lastnem TCP-ju.
  // Vsaka OsmAnd vrstica pa IMEI že nosi sama (?id=...), zato jo filtriramo neposredno po tem,
  // mimo (nezanesljive) preslikave prek seje.
  directImei?: string;
};

export async function getRawDataForImei(
  imei: string,
  from?: string,
  to?: string
): Promise<{ lines: RawLogLine[]; scannedBytes: number }> {
  const fromDate = from ?? todayStr();
  const toDate = to ?? fromDate;

  const logPaths = (await Promise.all(daysInRange(fromDate, toDate).map(resolveLogPath))).filter(
    (p): p is string => p !== null
  );
  if (logPaths.length === 0) return { lines: [], scannedBytes: 0 };

  const text = (await Promise.all(logPaths.map(readLogTail))).join("\n");
  const rawLines = text.split("\n");

  const parsed: ParsedLine[] = [];
  const sessionToImei = new Map<string, string>();

  for (const line of rawLines) {
    const hexMatch = line.match(HEX_LINE);
    if (hexMatch) {
      const [, timestamp, sessionId, protocol, dir, remoteAddress, hex] = hexMatch;
      parsed.push({ timestamp, sessionId, kind: dir === "<" ? "in" : "out", protocol, remoteAddress, hex });
      continue;
    }
    const osmandMatch = line.match(OSMAND_LINE);
    if (osmandMatch) {
      const [, timestamp, sessionId, protocol, dir, remoteAddress, payload] = osmandMatch;
      const directImei = payload.match(OSMAND_ID)?.[1];
      parsed.push({ timestamp, sessionId, kind: dir === "<" ? "in" : "out", protocol, remoteAddress, hex: payload, directImei });
      continue;
    }
    const bracketMatch = line.match(BRACKET_LINE);
    if (!bracketMatch) continue;
    const [, timestamp, sessionId, rest] = bracketMatch;
    if (rest === "connected" || rest === "disconnected") {
      parsed.push({ timestamp, sessionId, kind: rest, protocol: null, remoteAddress: null, hex: null });
      continue;
    }
    // "id: ..., time: ..., lat: ..." vrstice niso surovi podatki, uporabimo jih samo za povezavo seja->IMEI spodaj.
    const idMatch = rest.match(ID_LINE);
    if (idMatch) sessionToImei.set(sessionId, idMatch[1]);
  }

  for (const line of parsed) {
    if (line.kind === "in" && line.hex && !line.directImei && !sessionToImei.has(line.sessionId)) {
      const decoded = decodeHandshakeImei(line.hex);
      if (decoded) sessionToImei.set(line.sessionId, decoded);
    }
  }

  const lines: RawLogLine[] = parsed.filter((l) => (l.directImei ?? sessionToImei.get(l.sessionId)) === imei);

  return { lines, scannedBytes: Buffer.byteLength(text, "utf-8") };
}
