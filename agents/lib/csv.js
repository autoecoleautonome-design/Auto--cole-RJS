// Lecture/écriture CSV tolérante (séparateur ; ou , ou tabulation, guillemets, BOM).

export function parseCSV(text) {
  text = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const firstLine = text.split("\n", 1)[0];
  const sep = [";", "\t", ","].map((s) => [s, firstLine.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const clean = rows.filter((r) => r.some((v) => v.trim() !== ""));
  if (!clean.length) return [];
  const headers = clean[0].map((h) => normalizeHeader(h));
  return clean.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
}

export function normalizeHeader(h) {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function toCSV(rows, columns) {
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(";"), ...rows.map((r) => columns.map((c) => esc(r[c])).join(";"))].join("\n") + "\n";
}

/** "1 234,56" / "-1234.56" / "1.234,56 €" → nombre */
export function parseAmount(v) {
  if (typeof v === "number") return v;
  let s = String(v ?? "").replace(/[€\s ]/g, "");
  if (!s) return 0;
  if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = Number(s);
  if (Number.isNaN(n)) throw new Error(`Montant illisible : « ${v} »`);
  return n;
}

/** "31/10/2026", "2026-10-31", "31-10-26" → "2026-10-31" */
export function parseDate(v) {
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  throw new Error(`Date illisible : « ${v} »`);
}
