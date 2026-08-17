import "server-only";
import { open, stat } from "node:fs/promises";

const LOG_PATH = "/opt/traccar/logs/tracker-server.log";
// Prebere samo rep dnevnika -- dnevnik ob prometnem voznem parku raste neomejeno,
// zato branje celotne datoteke ob vsakem kliku ne bi bilo smiselno.
const TAIL_BYTES = 4 * 1024 * 1024;

export type RawLogLine = {
  timestamp: string;
  sessionId: string;
  kind: "connected" | "disconnected" | "in" | "out";
  protocol: string | null;
  remoteAddress: string | null;
  hex: string | null;
};

const HEX_LINE = /^(\S+ \S+)\s+INFO:\s+\[(\w+):\s*(\S+)\s+([<>])\s+([\d.]+)\]\s+([0-9a-fA-F]+)\s*$/;
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

async function readLogTail(): Promise<string> {
  const stats = await stat(LOG_PATH);
  const start = Math.max(0, stats.size - TAIL_BYTES);
  const length = stats.size - start;
  const handle = await open(LOG_PATH, "r");
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

export async function getRawDataForImei(imei: string): Promise<{ lines: RawLogLine[]; scannedBytes: number }> {
  const text = await readLogTail();
  const rawLines = text.split("\n");

  const parsed: RawLogLine[] = [];
  const sessionToImei = new Map<string, string>();

  for (const line of rawLines) {
    const hexMatch = line.match(HEX_LINE);
    if (hexMatch) {
      const [, timestamp, sessionId, protocol, dir, remoteAddress, hex] = hexMatch;
      parsed.push({ timestamp, sessionId, kind: dir === "<" ? "in" : "out", protocol, remoteAddress, hex });
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
    if (line.kind === "in" && line.hex && !sessionToImei.has(line.sessionId)) {
      const decoded = decodeHandshakeImei(line.hex);
      if (decoded) sessionToImei.set(line.sessionId, decoded);
    }
  }

  const lines = parsed.filter((l) => sessionToImei.get(l.sessionId) === imei);

  return { lines, scannedBytes: Buffer.byteLength(text, "utf-8") };
}
