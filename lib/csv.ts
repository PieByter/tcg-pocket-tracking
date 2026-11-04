export type CsvDelimiter = "," | ";" | "\t";

export const CSV_DELIMITERS: CsvDelimiter[] = [",", ";", "\t"];

export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",;\t\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(
  rows: (string | number | null | undefined)[][],
  delimiter: CsvDelimiter = ",",
): string {
  return `${rows.map((row) => row.map(escapeCsvCell).join(delimiter)).join("\r\n")}\r\n`;
}

/** BOM agar Excel (terutama versi Windows) membaca UTF-8 dengan benar. */
export function withBom(text: string): string {
  return `\uFEFF${text}`;
}

export function detectDelimiter(text: string): CsvDelimiter {
  const sample = text
    .split(/\r?\n/)
    .find((line) => line.trim().length > 0);
  if (!sample) return ",";
  let best: CsvDelimiter = ",";
  let bestCount = 0;
  for (const delimiter of CSV_DELIMITERS) {
    const count = countUnquoted(sample, delimiter);
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

function countUnquoted(line: string, delimiter: string): number {
  let quoted = false;
  let count = 0;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        index += 1;
        continue;
      }
      quoted = !quoted;
      continue;
    }
    if (!quoted && char === delimiter) count += 1;
  }
  return count;
}

/** Parser CSV penuh: mendukung kutip ganda, kutip ter-escape, dan baris multi-line. */
export function parseCsv(text: string, delimiter: CsvDelimiter): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      // Lewati; newline berikutnya menutup baris.
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
