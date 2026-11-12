// Lecture d'un fichier de tableau dans le navigateur : .csv (ou .txt) et .xlsx.

import { detectSeparator, parseCsv } from "@/lib/csv";

export type TableFile = { headers: string[]; rows: Record<string, string>[] };

/** Excel enregistre souvent les CSV en Windows-1252 : on retombe dessus si l'UTF-8 est invalide. */
function decodeText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

function cellToString(cell: unknown): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) {
    if (Number.isNaN(cell.getTime())) return "";
    const iso = cell.toISOString();
    // Cellule « heure » seule (Excel la date de 1899/1900)
    if (cell.getUTCFullYear() < 1901) return iso.slice(11, 16);
    // Date seule → aaaa-mm-jj ; date + heure → sans fuseau (interprétée en heure de Paris)
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso.slice(0, 16);
  }
  return String(cell).trim();
}

async function readXlsx(file: File): Promise<TableFile> {
  const { readSheet } = await import("read-excel-file/browser");
  const data = (await readSheet(file)) as unknown[][];
  if (data.length === 0) return { headers: [], rows: [] };
  const headers = data[0].map(cellToString);
  const rows: Record<string, string>[] = [];
  for (const line of data.slice(1)) {
    const record: Record<string, string> = {};
    let hasValue = false;
    headers.forEach((h, i) => {
      if (!h) return;
      const v = cellToString(line[i]);
      if (v !== "") hasValue = true;
      record[h] = v;
    });
    if (hasValue) rows.push(record);
  }
  return { headers: headers.filter(Boolean), rows };
}

export async function readTableFile(file: File): Promise<TableFile> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xls")) {
    throw new Error("le format .xls (ancien Excel) n'est pas pris en charge. Enregistrez le fichier en .xlsx ou en .csv.");
  }
  if (name.endsWith(".xlsx")) return readXlsx(file);

  const text = decodeText(await file.arrayBuffer());
  const rows = parseCsv(text);
  let headers: string[];
  if (rows.length > 0) {
    headers = Object.keys(rows[0]);
  } else {
    const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
    headers = firstLine
      .split(detectSeparator(text))
      .map((h) => h.replace(/^"|"$/g, "").trim())
      .filter(Boolean);
  }
  return { headers, rows };
}
