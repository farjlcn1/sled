import {
  MAGIC,
  FileKind,
  BlockType,
  type TachoData,
  type ActivityRecord,
  type EventRecord,
  type ActivityTypeValue,
  type EventTypeValue,
} from "./format";

export class TachoDecodeError extends Error {}

function readString(buf: Buffer, offset: number): { value: string; next: number } {
  const len = buf.readUInt16BE(offset);
  const value = buf.toString("utf8", offset + 2, offset + 2 + len);
  return { value, next: offset + 2 + len };
}

function decodeActivities(buf: Buffer): ActivityRecord[] {
  const count = buf.readUInt16BE(0);
  const out: ActivityRecord[] = [];
  let offset = 2;
  for (let i = 0; i < count; i++) {
    const time = new Date(Number(buf.readBigInt64BE(offset)));
    const activityType = buf.readUInt8(offset + 8) as ActivityTypeValue;
    out.push({ time, activityType });
    offset += 9;
  }
  return out;
}

function decodeEvents(buf: Buffer): EventRecord[] {
  const count = buf.readUInt16BE(0);
  const out: EventRecord[] = [];
  let offset = 2;
  for (let i = 0; i < count; i++) {
    const time = new Date(Number(buf.readBigInt64BE(offset)));
    const eventType = buf.readUInt8(offset + 8) as EventTypeValue;
    const { value: description, next } = readString(buf, offset + 9);
    out.push({ time, eventType, description });
    offset = next;
  }
  return out;
}

export function decode(buf: Buffer): TachoData {
  if (buf.length < 6 || buf.toString("ascii", 0, 4) !== MAGIC) {
    throw new TachoDecodeError("Datoteka ni v pričakovanem formatu (manjka glava).");
  }
  const kindByte = buf.readUInt8(5);

  let offset = 6;
  const blocks = new Map<number, Buffer>();
  while (offset < buf.length) {
    if (offset + 5 > buf.length) throw new TachoDecodeError("Datoteka je pokvarjena (nepričakovan konec bloka).");
    const type = buf.readUInt8(offset);
    const len = buf.readUInt32BE(offset + 1);
    const payloadStart = offset + 5;
    if (payloadStart + len > buf.length) throw new TachoDecodeError("Datoteka je pokvarjena (dolžina bloka presega datoteko).");
    blocks.set(type, buf.subarray(payloadStart, payloadStart + len));
    offset = payloadStart + len;
  }

  if (kindByte === FileKind.VOZNIK) {
    const idBuf = blocks.get(BlockType.IDENTIFICATION);
    if (!idBuf) throw new TachoDecodeError("Manjka blok identifikacije voznika.");
    const { value: fullName, next } = readString(idBuf, 0);
    const { value: idCode } = readString(idBuf, next);
    const activities = blocks.has(BlockType.ACTIVITY) ? decodeActivities(blocks.get(BlockType.ACTIVITY)!) : [];
    const events = blocks.has(BlockType.EVENTS) ? decodeEvents(blocks.get(BlockType.EVENTS)!) : [];
    return { kind: "VOZNIK", fullName, idCode, activities, events };
  }

  if (kindByte === FileKind.VOZILO) {
    const idBuf = blocks.get(BlockType.IDENTIFICATION);
    if (!idBuf) throw new TachoDecodeError("Manjka blok identifikacije vozila.");
    const { value: plate, next } = readString(idBuf, 0);
    const { value: vin } = readString(idBuf, next);
    const summaryBuf = blocks.get(BlockType.VEHICLE_SUMMARY);
    if (!summaryBuf) throw new TachoDecodeError("Manjka blok povzetka vozila.");
    const odometerKm = summaryBuf.readUInt32BE(0);
    const periodFrom = new Date(Number(summaryBuf.readBigInt64BE(4)));
    const periodTo = new Date(Number(summaryBuf.readBigInt64BE(12)));
    const events = blocks.has(BlockType.EVENTS) ? decodeEvents(blocks.get(BlockType.EVENTS)!) : [];
    return { kind: "VOZILO", plate, vin, odometerKm, periodFrom, periodTo, events };
  }

  throw new TachoDecodeError(`Neznan tip datoteke (${kindByte}).`);
}

export type DailyActivitySummary = {
  date: string;
  drivingMin: number;
  workMin: number;
  availabilityMin: number;
  restMin: number;
};

// Iz zaporedja "sprememb aktivnosti" izračuna dnevne vsote po tipu aktivnosti (kot jih prikazujejo
// orodja za analizo tahografskih podatkov) — vsaka aktivnost traja do naslednje spremembe.
export function summarizeDailyActivity(activities: ActivityRecord[]): DailyActivitySummary[] {
  const sorted = [...activities].sort((a, b) => a.time.getTime() - b.time.getTime());
  const byDate = new Map<string, DailyActivitySummary>();

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    if (!next) continue;
    const durationMin = (next.time.getTime() - cur.time.getTime()) / 60000;
    const date = cur.time.toISOString().slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, { date, drivingMin: 0, workMin: 0, availabilityMin: 0, restMin: 0 });
    const entry = byDate.get(date)!;
    if (cur.activityType === 3) entry.drivingMin += durationMin;
    else if (cur.activityType === 2) entry.workMin += durationMin;
    else if (cur.activityType === 1) entry.availabilityMin += durationMin;
    else entry.restMin += durationMin;
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}
