"use client";

import { useMemo, useState } from "react";
import { DeleteFileButton } from "./delete-file-button";

export type TachoFileRow = {
  id: string;
  kind: "VOZILO" | "VOZNIK";
  fileName: string;
  fileSize: number;
  downloadedAt: Date;
  periodFrom: Date | null;
  periodTo: Date | null;
  vehicle: { plate: string } | null;
  driver: { fullName: string } | null;
};

type SortDir = "asc" | "desc";
type ColumnKey = "kind" | "vehicleOrDriver" | "fileName" | "period" | "fileSize" | "downloadedAt";

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "kind", label: "Tip" },
  { key: "vehicleOrDriver", label: "Vozilo/voznik" },
  { key: "fileName", label: "Ime datoteke" },
  { key: "period", label: "Obdobje" },
  { key: "fileSize", label: "Velikost" },
  { key: "downloadedAt", label: "Naloženo" },
];

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString("sl-SI", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function sortValue(f: TachoFileRow, key: ColumnKey): string | number {
  switch (key) {
    case "kind":
      return f.kind === "VOZILO" ? "Vozilo" : "Voznik";
    case "vehicleOrDriver":
      return f.vehicle?.plate ?? f.driver?.fullName ?? "";
    case "fileName":
      return f.fileName;
    case "period":
      return f.periodFrom ? f.periodFrom.getTime() : -Infinity;
    case "fileSize":
      return f.fileSize;
    case "downloadedAt":
      return f.downloadedAt.getTime();
  }
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "sl-SI", { numeric: true });
}

export function TachoFilesTable({ files }: { files: TachoFileRow[] }) {
  const [sort, setSort] = useState<{ key: ColumnKey; dir: SortDir } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return files;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...files].sort((a, b) => factor * compare(sortValue(a, sort.key), sortValue(b, sort.key)));
  }, [files, sort]);

  function handleSort(key: ColumnKey) {
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function sortIndicator(key: ColumnKey) {
    if (sort?.key !== key) return "";
    return sort.dir === "asc" ? " ▲" : " ▼";
  }

  return (
    <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className="cursor-pointer select-none px-3 py-2 text-left text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {col.label}
                {sortIndicator(col.key)}
              </th>
            ))}
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {sorted.map((f) => (
            <tr key={f.id}>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{f.kind === "VOZILO" ? "Vozilo" : "Voznik"}</td>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{f.vehicle?.plate ?? f.driver?.fullName ?? "—"}</td>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{f.fileName}</td>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                {fmtDate(f.periodFrom)} – {fmtDate(f.periodTo)}
              </td>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{fmtSize(f.fileSize)}</td>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{fmtDate(f.downloadedAt)}</td>
              <td className="px-3 py-2 text-right">
                <div className="flex items-center justify-end gap-2">
                  <a
                    href={`/tacho/pregled/${f.id}`}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 dark:border-gray-600 dark:text-gray-300"
                  >
                    Poglej
                  </a>
                  <DeleteFileButton id={f.id} />
                </div>
              </td>
            </tr>
          ))}
          {files.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Ni še naloženih datotek.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
