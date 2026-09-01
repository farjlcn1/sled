import "server-only";
import { getTraccarPositions, sendTraccarCommand } from "@/lib/traccar";

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 12000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Pošlje ukaz napravi in počaka na odgovor. Teltonika (Codec 12) odgovor pride po ISTI podatkovni
// povezavi kot pozicije -- Traccar ga izpostavi kot attributes.result na naslednji poziciji te
// naprave (TeltonikaProtocolDecoder.decodeSerial -> Position.KEY_RESULT, potrjeno iz izvorne
// kode). Zato čakamo na pozicijo z DRUGAČNO id od tiste tik pred pošiljanjem IN nastavljenim
// result -- brez tega bi lahko pomotoma prebrali vmesni reden položajni zapis. Če naprava
// trenutno ni povezana (ali se odgovoru ne odzove pravočasno), vrne null -- klicatelj naj to
// obravnava kot "naprava ni odgovorila", ne kot napako.
export async function sendCommandAndAwaitResult(traccarDeviceId: number, command: string): Promise<string | null> {
  const [before] = await getTraccarPositions([traccarDeviceId]);
  const baselineId = before?.id ?? null;

  await sendTraccarCommand(traccarDeviceId, command);

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const [latest] = await getTraccarPositions([traccarDeviceId]);
    const result = latest?.attributes.result;
    if (latest && latest.id !== baselineId && typeof result === "string" && result.length > 0) {
      return result;
    }
  }
  return null;
}

// Primer odgovora na "getver": "Ver:02.00.01_06 GPS:AXN_3.80_3333_16070400,0000,, Hw:TFT100
// Mod:1 IMEI:352094000000000 ..." -- Hw je dejanski strojni model naprave.
export function parseHwModel(getverResponse: string): string | null {
  const match = getverResponse.match(/\bHw:(\S+)/);
  return match ? match[1] : null;
}

// Točen format odgovora na "getimeiccid" ni v celoti dokumentiran (Teltonika wiki podstran je bila
// prazna) -- ICCID je standardno 18-22-mestno število, zato poleg morebitne "ICCID:" oznake kot
// varovalko preverimo tudi najdaljše tako dolgo zaporedje števk v odgovoru.
export function parseIccid(getimeiccidResponse: string): string | null {
  const labeled = getimeiccidResponse.match(/ICCID:?\s*(\d{18,22})/i);
  if (labeled) return labeled[1];
  const digitRuns = getimeiccidResponse.match(/\d{18,22}/g);
  if (!digitRuns || digitRuns.length === 0) return null;
  return digitRuns.reduce((longest, run) => (run.length > longest.length ? run : longest), "");
}
