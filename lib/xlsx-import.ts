import "server-only";
import ExcelJS from "exceljs";

// Prebere prvo delovno stran xlsx datoteke: prva vrstica so glave stolpcev,
// vsaka naslednja vrstica postane objekt {glava: vrednost}. Prazne vrstice se preskočijo.
export async function parseXlsxRows(file: File): Promise<Record<string, string>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber] = String(cell.text ?? "").trim();
  });

  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, string> = {};
    let hasValue = false;
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (!header) return;
      // .text uporabi prikazano besedilo celice (izogne se npr. znanstvenemu zapisu
      // dolgih številčnih nizov, kot so IMEI/serijske številke, ki bi jih .value dal kot float).
      const value = String(cell.text ?? "").trim();
      record[header] = value;
      if (value) hasValue = true;
    });
    if (hasValue) rows.push(record);
  });

  return rows;
}

export function findColumn(row: Record<string, string>, ...aliases: string[]): string | undefined {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const key = keys.find((k) => k.toLowerCase() === alias.toLowerCase());
    if (key && row[key]) return row[key];
  }
  return undefined;
}
