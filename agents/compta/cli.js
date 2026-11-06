#!/usr/bin/env node
// Comptabilité du mois en ligne de commande.
//   npm run agent:compta -- --mois 2026-10 --releve exemples/releve-2026-10.csv
//   options : --sans-ia  --envoyer (envoie le rapport à COMPTA_DESTINATAIRE)
import { parseArgs } from "node:util";
import { runCompta, eur } from "./index.js";
import { deliver } from "../lib/mail.js";
import { previousMonth, todayParis } from "../lib/dates.js";

const { values: a } = parseArgs({
  options: {
    mois: { type: "string" },
    releve: { type: "string" },
    sorties: { type: "string", default: "sorties/compta" },
    "sans-ia": { type: "boolean", default: false },
    envoyer: { type: "boolean", default: false },
  },
});
const mois = a.mois || previousMonth(todayParis().slice(0, 7));
const releve = a.releve || `compta/releves/${mois}.csv`;

const r = await runCompta({ mois, releve, outDir: a.sorties, ai: a["sans-ia"] ? false : undefined });
const s = r.synthese;
console.log(`Comptabilité ${mois} : ${s.nb_operations} opérations`);
console.log(`  CA HT ${eur(s.chiffre_affaires_ht)} | charges HT ${eur(s.charges_ht)} | résultat estimé ${eur(s.resultat_estime_ht)}`);
console.log(`  TVA nette estimée ${eur(s.tva_nette_estimee)} | à vérifier : ${s.a_verifier}`);
console.log(`  Rapport : ${r.dir}/rapport.md`);

if (a.envoyer && process.env.COMPTA_DESTINATAIRE) {
  const [res] = await deliver([{ to: process.env.COMPTA_DESTINATAIRE, subject: `Comptabilité ${mois} : synthèse automatique`, text: r.rapport }], { dir: `${r.dir}/email`, send: true });
  console.log(`  E-mail : ${res.status}`);
}
