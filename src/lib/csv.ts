// Petit parseur/générateur CSV (séparateur détecté automatiquement : ; , ou tabulation).

export function detectSeparator(sample: string): string {
  const firstLine = sample.split(/\r?\n/, 1)[0] ?? "";
  const counts: Record<string, number> = {
    ";": (firstLine.match(/;/g) ?? []).length,
    "\t": (firstLine.match(/\t/g) ?? []).length,
    ",": (firstLine.match(/,/g) ?? []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ";";
}

export function parseCsv(text: string): Record<string, string>[] {
  const sep = detectSeparator(text);
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === sep) {
      cur.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      cur.push(field);
      field = "";
      if (cur.length > 1 || cur[0] !== "") rows.push(cur);
      cur = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || cur.length > 0) {
    cur.push(field);
    if (cur.length > 1 || cur[0] !== "") rows.push(cur);
  }
  if (rows.length === 0) return [];

  const keys = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .filter((r) => r.some((cell) => cell.trim() !== ""))
    .map((r) => {
      const obj: Record<string, string> = {};
      keys.forEach((k, i) => {
        obj[k] = (r[i] ?? "").trim();
      });
      return obj;
    });
}

export function toCsv(rows: Record<string, unknown>[], headers: { key: string; label: string }[]): string {
  const esc = (v: unknown): string => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map((h) => esc(h.label)).join(";")];
  for (const row of rows) {
    lines.push(headers.map((h) => esc(row[h.key])).join(";"));
  }
  return "﻿" + lines.join("\n");
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
