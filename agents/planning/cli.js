#!/usr/bin/env node
// Agent planning en ligne de commande.
//   npm run agent:planning -- --mode recap --csv exemples/planning-semaine.csv
//   npm run agent:planning -- --mode changements            (lit PLANNING_ICS_URL)
//   options : --date AAAA-MM-JJ  --envoyer  --sans-ia
import { parseArgs } from "node:util";
import { loadCSV, loadICS } from "./source.js";
import { runPlanning } from "./index.js";

const { values: a } = parseArgs({
  options: {
    mode: { type: "string", default: "recap" },
    csv: { type: "string" },
    ics: { type: "string" },
    date: { type: "string" },
    envoyer: { type: "boolean", default: false },
    "sans-ia": { type: "boolean", default: false },
    etat: { type: "string", default: "etat/planning-precedent.json" },
    sorties: { type: "string", default: "sorties/planning" },
    public: { type: "string", default: "public/data/annonces.json" },
  },
});

if (!["recap", "changements"].includes(a.mode)) {
  console.error("--mode doit valoir « recap » ou « changements »");
  process.exit(1);
}
const icsUrl = a.ics || process.env.PLANNING_ICS_URL;
if (!a.csv && !icsUrl) {
  console.error("Indiquez une source : --csv fichier.csv, --ics URL, ou la variable PLANNING_ICS_URL.");
  process.exit(1);
}

const events = a.csv ? await loadCSV(a.csv) : await loadICS(icsUrl);
const r = await runPlanning({
  events,
  mode: a.mode,
  today: a.date,
  snapshotPath: a.etat,
  outDir: a.sorties,
  publicPath: a.public,
  send: a.envoyer,
  ai: a["sans-ia"] ? false : undefined,
});

console.log(`Semaine ${r.publicData.semaine.label} (${r.publicData.genere_par})`);
console.log(`  ${r.stats.lecons} leçons, ${r.stats.examens} examens, ${r.stats.annulations} annulations`);
console.log(`  Changements détectés : ${r.diff.total}`);
console.log(`  Site ${r.publie ? "mis à jour" : "inchangé"} ; e-mails : ${r.emails.filter((e) => e.status === "envoyé").length} envoyés, ${r.emails.filter((e) => e.status === "brouillon").length} brouillons`);
console.log(`  Dossier : ${r.dir}`);
