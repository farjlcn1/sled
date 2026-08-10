export type ReportType = "voznje" | "postanki" | "gorivo" | "hitrost" | "eko" | "vse";

export const REPORT_TYPE_OPTIONS: { value: ReportType; label: string }[] = [
  { value: "voznje", label: "Poročilo o vožnjah" },
  { value: "postanki", label: "Poročilo o postankih" },
  { value: "gorivo", label: "Poročilo o gorivu" },
  { value: "hitrost", label: "Poročilo o hitrosti" },
  { value: "eko", label: "Poročilo o varčni vožnji" },
  { value: "vse", label: "Poročilo — vse" },
];
