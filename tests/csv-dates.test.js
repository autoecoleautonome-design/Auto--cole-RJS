import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCSV, parseAmount, parseDate, toCSV } from "../agents/lib/csv.js";
import { isoWeekLabel, mondayOf, previousMonth } from "../agents/lib/dates.js";

test("parseCSV détecte le séparateur et gère les guillemets", () => {
  const rows = parseCSV('﻿Date;Libellé;Montant\n01/10/2026;"CB ""TOTAL""; station";-12,50\n');
  assert.deepEqual(rows, [{ date: "01/10/2026", libelle: 'CB "TOTAL"; station', montant: "-12,50" }]);
  assert.equal(parseCSV("a,b\n1,2\n")[0].b, "2");
});

test("parseAmount lit les formats français", () => {
  assert.equal(parseAmount("1 234,56 €"), 1234.56);
  assert.equal(parseAmount("-1.234,56"), -1234.56);
  assert.equal(parseAmount("1,234.56"), 1234.56);
  assert.equal(parseAmount(""), 0);
  assert.throws(() => parseAmount("abc"));
});

test("parseDate normalise les dates", () => {
  assert.equal(parseDate("31/10/2026"), "2026-10-31");
  assert.equal(parseDate("2026-10-31"), "2026-10-31");
  assert.equal(parseDate("1.2.26"), "2026-02-01");
});

test("toCSV échappe les champs", () => {
  assert.equal(toCSV([{ a: 'x;"y"', b: 1 }], ["a", "b"]), 'a;b\n"x;""y""";1\n');
});

test("semaines ISO et mois", () => {
  assert.equal(isoWeekLabel("2026-11-06"), "2026-S45");
  assert.equal(isoWeekLabel("2027-01-01"), "2026-S53");
  assert.equal(mondayOf("2026-11-08"), "2026-11-02");
  assert.equal(previousMonth("2026-01"), "2025-12");
});
