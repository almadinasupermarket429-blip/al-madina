// Minimal CSV reading/writing for spreadsheet export/import (Excel, Numbers, Google Sheets).
// German Excel uses ";" as the separator, so that is what we write; when reading,
// the separator is detected from the header line.

const needsQuotes = /[";,\r\n]/;

// Text starting with one of these is run as a formula by Excel/Sheets (CSV injection), e.g. a customer
// named =HYPERLINK(...). Such text is written with a leading apostrophe, which Excel shows as plain text.
const formulaStart = /^[=+\-@\t\r]/;

function cell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (typeof value === "string" && formulaStart.test(s)) s = `'${s}`;
  return needsQuotes.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows → CSV text with a UTF-8 BOM so Excel shows umlauts correctly. */
export function toCsv(rows: unknown[][], separator = ";"): string {
  return "﻿" + rows.map((r) => r.map(cell).join(separator)).join("\r\n") + "\r\n";
}

/** CSV text → rows of strings. Handles quoted cells, doubled quotes and line breaks inside quotes. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const separator = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === separator) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Undo the apostrophe toCsv adds in front of formula-like text, so an exported file imports unchanged.
  return rows
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => r.map((c) => (c.startsWith("'") && formulaStart.test(c.slice(1)) ? c.slice(1) : c)));
}

/** Accepts "2,49", "2.49", "€ 2,49" → 2.49; returns null for empty/invalid. */
export function parseDecimal(value: string | undefined): number | null {
  if (value == null) return null;
  const s = value.replace(/[€\s]/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
