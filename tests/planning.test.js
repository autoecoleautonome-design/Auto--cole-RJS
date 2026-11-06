import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCSV, parseICS } from "../agents/planning/source.js";
import { diffPlanning } from "../agents/planning/diff.js";
import { runPlanning } from "../agents/planning/index.js";

const v1 = await loadCSV("exemples/planning-v1.csv");
const v2 = await loadCSV("exemples/planning-v2.csv");

test("diff : annulation, déplacement, ajout", () => {
  const d = diffPlanning(v1, v2);
  assert.ok(d.annules.some((e) => e.id === "c-1110-3"), "leçon d'Inès annulée");
  assert.ok(d.annules.some((e) => e.id === "code-1111"), "cours de code annulé");
  assert.ok(d.deplaces.some((x) => x.apres.id === "c-1112-1" && x.apres.debut === "11:00"), "leçon de Léa déplacée");
  assert.ok(d.ajoutes.some((e) => e.id === "c-1113-2"));
  assert.ok(d.modifies.some((x) => x.apres.id === "c-1110-2"), "note ajoutée pour Hugo");
});

test("diff : suppression + ajout du même élève = déplacement", () => {
  const a = [{ id: "x", type: "conduite", email: "a@b.fr", date: "2026-11-10", debut: "08:00", fin: "08:55", statut: "confirmé" }];
  const b = [{ id: "y", type: "conduite", email: "a@b.fr", date: "2026-11-12", debut: "10:00", fin: "10:55", statut: "confirmé" }];
  const d = diffPlanning(a, b);
  assert.equal(d.deplaces.length, 1);
  assert.equal(d.ajoutes.length + d.annules.length, 0);
});

test("parseICS lit un agenda Google", () => {
  const ics = [
    "BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:abc@google.com", "DTSTART:20261110T070000Z", "DTEND:20261110T075500Z",
    "SUMMARY:Conduite - Léa Martin", "DESCRIPTION:email: lea@exemple.fr\\nmoniteur: David", "END:VEVENT",
    "BEGIN:VEVENT", "UID:def", "DTSTART;VALUE=DATE:20261111", "SUMMARY:Fermeture", "STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const [a, b] = parseICS(ics);
  assert.equal(a.date, "2026-11-10");
  assert.equal(a.debut, "08:00", "UTC converti en heure de Paris");
  assert.equal(a.type, "conduite");
  assert.equal(a.eleve, "Léa Martin");
  assert.equal(a.email, "lea@exemple.fr");
  assert.equal(a.moniteur, "David");
  assert.equal(b.type, "fermeture");
});

test("runPlanning : annonces publiques sans nom d'élève, e-mails personnels", async () => {
  const dir = await mkdtemp(join(tmpdir(), "planning-"));
  const common = { snapshotPath: join(dir, "etat.json"), outDir: join(dir, "out"), publicPath: join(dir, "annonces.json"), ai: false };
  await runPlanning({ ...common, events: v1, mode: "recap", today: "2026-11-08" });
  const r = await runPlanning({ ...common, events: v2, mode: "changements", today: "2026-11-09" });
  const pub = await readFile(common.publicPath, "utf8");
  for (const nom of ["Léa", "Hugo", "Inès", "Yanis", "Sarah", "Nora", "@exemple.fr"]) assert.ok(!pub.includes(nom), `${nom} ne doit pas être publié`);
  assert.ok(JSON.parse(pub).annonces.some((a) => a.type === "changement"));
  const emails = await readdir(join(r.dir, "emails"));
  assert.ok(emails.some((f) => f.includes("ines")));
  assert.ok(!emails.some((f) => f.includes("nora")), "Nora n'a pas de changement");
});
