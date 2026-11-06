import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { categorizeByRules } from "../agents/compta/categories.js";
import { readStatement, computeSummary, runCompta } from "../agents/compta/index.js";

test("règles de classement", () => {
  const c = (libelle, montant) => categorizeByRules({ libelle, montant });
  assert.equal(c("VIR SEPA CAISSE DES DEPOTS CPF DOSSIER 1", 1490), "recette_cpf");
  assert.equal(c("PRLV SEPA URSSAF RHONE ALPES", -3980), "charges_sociales");
  assert.equal(c("PRLV SEPA DGFIP TVA SEPTEMBRE", -1612), "tva_reglee");
  assert.equal(c("CB TOTALENERGIES VILLEFRANCHE", -78.42), "carburant");
  assert.equal(c("REMISE CB TPE 0123", 1180), "recette_eleves");
  assert.equal(c("CB TOTALENERGIES VILLEFRANCHE", 78.42), null, "un crédit n'est pas une charge");
  assert.equal(c("LIBELLE INCONNU", -10), null);
});

test("relevé débit/crédit et calcul de TVA", () => {
  const txs = readStatement("Date;Libellé;Débit;Crédit\n02/10/2026;REMISE CB;;1200,00\n03/10/2026;CB ESSO;60,00;\n01/09/2026;HORS MOIS;;10\n", "2026-10");
  assert.equal(txs.length, 2);
  txs[0].categorie = "recette_eleves";
  txs[1].categorie = "carburant";
  const s = computeSummary(txs);
  assert.equal(s.chiffre_affaires_ht, 1000);
  assert.equal(s.tva_collectee, 200);
  assert.equal(s.charges_ht, 50);
  assert.equal(s.tva_nette_estimee, 190);
  assert.equal(s.variation_tresorerie, 1140);
});

test("runCompta sans IA sur l'exemple d'octobre", async () => {
  const dir = await mkdtemp(join(tmpdir(), "compta-"));
  const r = await runCompta({ mois: "2026-10", releve: "exemples/releve-2026-10.csv", outDir: dir, ai: false });
  assert.equal(r.synthese.nb_operations, 36);
  assert.equal(r.synthese.encaissements, 15185);
  const md = await readFile(join(r.dir, "rapport.md"), "utf8");
  assert.match(md, /Comptabilité de octobre 2026/);
  assert.match(await readFile(join(r.dir, "journal.csv"), "utf8"), /^date;libelle;montant/);
});
