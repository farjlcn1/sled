// Poenostavljen, samostojno definiran binarni format za tahografske podatke — NI bitno združljiv
// s pravim EU DDD formatom (Priloga 1C / Appendix 7 Uredbe (EU) 2016/799). Uporablja se dokler
// ni na voljo dejanski vir DDD datotek (TachoSync API ali podoben) — glej pogovor v seji.
// Struktura je namenoma podobna resničnemu konceptu TREP blokov (tip + dolžina + vsebina), da je
// kodo lažje kasneje zamenjati z dejanskim DDD parserjem, ko bo znan resnični vir podatkov.

export const MAGIC = "SDDD";
export const FORMAT_VERSION = 1;

export const FileKind = {
  VOZILO: 1,
  VOZNIK: 2,
} as const;
export type FileKindValue = (typeof FileKind)[keyof typeof FileKind];

export const BlockType = {
  IDENTIFICATION: 1,
  ACTIVITY: 2,
  EVENTS: 3,
  VEHICLE_SUMMARY: 4,
} as const;

export const ActivityType = {
  POCITEK: 0,
  RAZPOLOZLJIVOST: 1,
  DELO: 2,
  VOZNJA: 3,
} as const;
export type ActivityTypeValue = (typeof ActivityType)[keyof typeof ActivityType];

export const ACTIVITY_LABELS: Record<ActivityTypeValue, string> = {
  [ActivityType.POCITEK]: "Počitek",
  [ActivityType.RAZPOLOZLJIVOST]: "Razpoložljivost",
  [ActivityType.DELO]: "Delo",
  [ActivityType.VOZNJA]: "Vožnja",
};

export const EventType = {
  VSTAVITEV_KARTICE: 0,
  ODSTRANITEV_KARTICE: 1,
  PREKORACITEV_HITROSTI: 2,
  NAPAKA_NAPRAVE: 3,
  PREKINITEV_NAPAJANJA: 4,
} as const;
export type EventTypeValue = (typeof EventType)[keyof typeof EventType];

export const EVENT_LABELS: Record<EventTypeValue, string> = {
  [EventType.VSTAVITEV_KARTICE]: "Vstavitev kartice",
  [EventType.ODSTRANITEV_KARTICE]: "Odstranitev kartice",
  [EventType.PREKORACITEV_HITROSTI]: "Prekoračitev hitrosti",
  [EventType.NAPAKA_NAPRAVE]: "Napaka naprave",
  [EventType.PREKINITEV_NAPAJANJA]: "Prekinitev napajanja",
};

export type ActivityRecord = { time: Date; activityType: ActivityTypeValue };
export type EventRecord = { time: Date; eventType: EventTypeValue; description: string };

export type VoznikTachoData = {
  kind: "VOZNIK";
  fullName: string;
  idCode: string;
  activities: ActivityRecord[];
  events: EventRecord[];
};

export type VoziloTachoData = {
  kind: "VOZILO";
  plate: string;
  vin: string;
  odometerKm: number;
  periodFrom: Date;
  periodTo: Date;
  events: EventRecord[];
};

export type TachoData = VoznikTachoData | VoziloTachoData;
