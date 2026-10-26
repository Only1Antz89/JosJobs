// CSV helpers for admin exports. Cells that start with = + - @ (or a tab/CR) are
// prefixed with ' so spreadsheet apps don't run them as formulas.

export type CsvValue = string | number | boolean | null | undefined;

export function csvCell(value: CsvValue) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: CsvValue[][]) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
