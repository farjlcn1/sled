import { MAGIC, FORMAT_VERSION, FileKind, BlockType, type TachoData, type ActivityRecord, type EventRecord } from "./format";

function writeString(str: string): Buffer {
  const body = Buffer.from(str, "utf8");
  const len = Buffer.alloc(2);
  len.writeUInt16BE(body.length);
  return Buffer.concat([len, body]);
}

function encodeActivities(activities: ActivityRecord[]): Buffer {
  const count = Buffer.alloc(2);
  count.writeUInt16BE(activities.length);
  const records = activities.map((a) => {
    const buf = Buffer.alloc(9);
    buf.writeBigInt64BE(BigInt(a.time.getTime()), 0);
    buf.writeUInt8(a.activityType, 8);
    return buf;
  });
  return Buffer.concat([count, ...records]);
}

function encodeEvents(events: EventRecord[]): Buffer {
  const count = Buffer.alloc(2);
  count.writeUInt16BE(events.length);
  const records = events.map((e) => {
    const head = Buffer.alloc(9);
    head.writeBigInt64BE(BigInt(e.time.getTime()), 0);
    head.writeUInt8(e.eventType, 8);
    return Buffer.concat([head, writeString(e.description)]);
  });
  return Buffer.concat([count, ...records]);
}

function block(type: number, payload: Buffer): Buffer {
  const head = Buffer.alloc(5);
  head.writeUInt8(type, 0);
  head.writeUInt32BE(payload.length, 1);
  return Buffer.concat([head, payload]);
}

export function encode(data: TachoData): Buffer {
  const header = Buffer.alloc(6);
  header.write(MAGIC, 0, "ascii");
  header.writeUInt8(FORMAT_VERSION, 4);
  header.writeUInt8(data.kind === "VOZILO" ? FileKind.VOZILO : FileKind.VOZNIK, 5);

  const blocks: Buffer[] = [];

  if (data.kind === "VOZNIK") {
    blocks.push(block(BlockType.IDENTIFICATION, Buffer.concat([writeString(data.fullName), writeString(data.idCode)])));
    blocks.push(block(BlockType.ACTIVITY, encodeActivities(data.activities)));
    blocks.push(block(BlockType.EVENTS, encodeEvents(data.events)));
  } else {
    blocks.push(block(BlockType.IDENTIFICATION, Buffer.concat([writeString(data.plate), writeString(data.vin)])));
    const summary = Buffer.alloc(20);
    summary.writeUInt32BE(Math.round(data.odometerKm), 0);
    summary.writeBigInt64BE(BigInt(data.periodFrom.getTime()), 4);
    summary.writeBigInt64BE(BigInt(data.periodTo.getTime()), 12);
    blocks.push(block(BlockType.VEHICLE_SUMMARY, summary));
    blocks.push(block(BlockType.EVENTS, encodeEvents(data.events)));
  }

  return Buffer.concat([header, ...blocks]);
}
