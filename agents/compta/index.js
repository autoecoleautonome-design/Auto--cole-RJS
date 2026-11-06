// Agent « Comptabilité du mois »
// 1. lit le relevé bancaire du mois (CSV exporté de la banque)
// 2. classe chaque opération : règles d'abord, puis Claude pour les libellés inconnus
// 3. calcule les totaux EN CODE (jamais par l'IA) : CA HT, TVA collectée/déductible, charges, trésorerie
// 4. fait rédiger par Claude une analyse à partir de ces chiffres, et produit rapport + journal CSV
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { getClient, hasApiKey, MODEL, FALLBACK, assertUsable, textOf } from "../lib/claude.js";
import { parseCSV, parseAmount, parseDate, toCSV } from "../lib/csv.js";
import { monthLabel, previousMonth } from "../lib/dates.js";
import { CATEGORIES, CATEGORY_KEYS, categorizeByRules } from "./categories.js";

const round2 = (n) => Math.round(n * 100) / 100;
export const eur = (n) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/** Lit un relevé : colonnes date + libellé + (montant | débit/crédit). */
export function readStatement(text, month) {
  const rows = parseCSV(text);
  const pick = (r, ...keys) => keys.map((k) => r[k]).find((v) => v !== undefined && v !== "");
  return rows
    .map((r, i) => {
      const date = parseDate(pick(r, "date", "date_operation", "date_de_l_operation", "date_comptable", "date_valeur"));
      const libelle = pick(r, "libelle", "libelle_operation", "description", "operation", "intitule", "detail") || "";
      let montant;
      const m = pick(r, "montant", "montant_eur", "amount");
      if (m !== undefined) montant = parseAmount(m);
      else montant = parseAmount(pick(r, "credit", "credit_eur") || 0) - Math.abs(parseAmount(pick(r, "debit", "debit_eur") || 0));
      return { id: `t${String(i + 1).padStart(3, "0")}`, date, libelle: libelle.trim(), montant: round2(montant) };
    })
    .filter((t) => t.montant !== 0 && (!month || t.date.startsWith(month)));
}

const Classement = z.object({
  classements: z.array(
    z.object({
      id: z.string(),
      categorie: z.enum(CATEGORY_KEYS),
      confiance: z.enum(["haute", "moyenne", "faible"]),
      justification: z.string().describe("Quelques mots"),
    }),
  ),
});

async function categorizeWithClaude(txs) {
  const client = getClient();
  const out = new Map();
  // Par lots de 80 opérations
  for (let i = 0; i < txs.length; i += 80) {
    const batch = txs.slice(i, i + 80);
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      ...FALLBACK,
      output_config: { effort: "medium", format: betaZodOutputFormat(Classement) },
      system: `Tu es l'assistant comptable d'une auto-école française (SAS, prestations de formation à la conduite soumises à la TVA).
Classe chaque opération bancaire dans une des catégories fournies. Un montant positif est un crédit (encaissement), négatif un débit (dépense).
Si tu n'es pas raisonnablement sûr, utilise "a_classer" avec la confiance "faible" : un humain vérifiera.
Catégories :
${CATEGORY_KEYS.map((k) => `- ${k} : ${CATEGORIES[k].libelle} (${CATEGORIES[k].sens})`).join("\n")}`,
      messages: [{ role: "user", content: `Opérations à classer (JSON) :\n${JSON.stringify(batch)}` }],
    });
    assertUsable(response);
    for (const c of response.parsed_output?.classements ?? []) out.set(c.id, c);
  }
  return out;
}

/** Calcul des totaux à partir des opérations classées. */
export function computeSummary(txs) {
  const parCategorie = {};
  for (const t of txs) {
    const c = CATEGORIES[t.categorie];
    const ttc = Math.abs(t.montant);
    const ht = c.tva ? ttc / (1 + c.tva / 100) : ttc;
    t.ht = round2(t.montant < 0 ? -ht : ht);
    t.tva = round2(t.montant - t.ht);
    t.compte = c.compte;
    t.taux_tva = c.tva;
    const agg = (parCategorie[t.categorie] ??= { categorie: t.categorie, libelle: c.libelle, compte: c.compte, sens: c.sens, nb: 0, ttc: 0, ht: 0, tva: 0 });
    agg.nb++;
    agg.ttc = round2(agg.ttc + ttc);
    agg.ht = round2(agg.ht + ht);
    agg.tva = round2(agg.tva + Math.abs(t.tva));
  }
  const cats = Object.values(parCategorie);
  const sum = (sens, key) => round2(cats.filter((c) => c.sens === sens).reduce((s, c) => s + c[key], 0));
  const encaissements = round2(txs.filter((t) => t.montant > 0).reduce((s, t) => s + t.montant, 0));
  const decaissements = round2(-txs.filter((t) => t.montant < 0).reduce((s, t) => s + t.montant, 0));
  const tvaCollectee = sum("produit", "tva");
  const tvaDeductible = sum("charge", "tva");
  return {
    nb_operations: txs.length,
    encaissements,
    decaissements,
    variation_tresorerie: round2(encaissements - decaissements),
    chiffre_affaires_ht: sum("produit", "ht"),
    chiffre_affaires_ttc: sum("produit", "ttc"),
    charges_ht: sum("charge", "ht"),
    resultat_estime_ht: round2(sum("produit", "ht") - sum("charge", "ht")),
    tva_collectee: tvaCollectee,
    tva_deductible_estimee: tvaDeductible,
    tva_nette_estimee: round2(tvaCollectee - tvaDeductible),
    masse_salariale: round2((parCategorie.salaires?.ttc || 0) + (parCategorie.charges_sociales?.ttc || 0)),
    part_cpf: sum("produit", "ttc") ? round2(((parCategorie.recette_cpf?.ttc || 0) / sum("produit", "ttc")) * 100) : 0,
    a_verifier: txs.filter((t) => t.categorie === "a_classer" || t.confiance === "faible").length,
    par_categorie: cats.sort((a, b) => b.ttc - a.ttc),
  };
}

/**
 * @param {object} o
 * @param {string} o.mois          AAAA-MM
 * @param {string} o.releve        chemin du CSV bancaire
 * @param {string} o.outDir        dossier de sortie (ex. sorties/compta)
 * @param {boolean} [o.ai]
 */
export async function runCompta(o) {
  const txs = readStatement(await readFile(o.releve, "utf8"), o.mois);
  if (!txs.length) throw new Error(`Aucune opération trouvée pour ${o.mois} dans ${o.releve}.`);
  const useAI = o.ai ?? hasApiKey();

  for (const t of txs) {
    const cat = categorizeByRules(t);
    if (cat) Object.assign(t, { categorie: cat, source: "règle", confiance: "haute" });
  }
  const inconnues = txs.filter((t) => !t.categorie);
  if (inconnues.length && useAI) {
    const res = await categorizeWithClaude(inconnues.map(({ id, date, libelle, montant }) => ({ id, date, libelle, montant })));
    for (const t of inconnues) {
      const c = res.get(t.id);
      if (c) Object.assign(t, { categorie: c.categorie, source: "IA", confiance: c.confiance, justification: c.justification });
    }
  }
  for (const t of txs) if (!t.categorie) Object.assign(t, { categorie: "a_classer", source: "aucune", confiance: "faible" });

  const synthese = computeSummary(txs);
  const dir = join(o.outDir, o.mois);
  const prevPath = join(o.outDir, previousMonth(o.mois), "synthese.json");
  const precedent = existsSync(prevPath) ? JSON.parse(await readFile(prevPath, "utf8")).synthese : null;

  const analyse = useAI ? await analyseWithClaude(o.mois, synthese, precedent, txs) : analyseSimple(synthese, precedent);

  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "journal.csv"), toCSV(txs, ["date", "libelle", "montant", "categorie", "compte", "taux_tva", "ht", "tva", "source", "confiance", "justification"]));
  await writeFile(join(dir, "synthese.json"), JSON.stringify({ mois: o.mois, genere_le: new Date().toISOString(), synthese }, null, 2));
  const rapport = renderReport(o.mois, synthese, precedent, analyse, txs, useAI);
  await writeFile(join(dir, "rapport.md"), rapport);
  return { dir, synthese, rapport, txs };
}

async function analyseWithClaude(mois, synthese, precedent, txs) {
  const client = getClient();
  const top = txs.filter((t) => t.montant < 0).sort((a, b) => a.montant - b.montant).slice(0, 8).map(({ date, libelle, montant, categorie }) => ({ date, libelle, montant, categorie }));
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    ...FALLBACK,
    output_config: { effort: "medium" },
    system: `Tu es l'assistant de gestion du gérant d'une auto-école. Tu commentes une synthèse comptable mensuelle déjà calculée.
Règles : utilise uniquement les chiffres fournis, n'en calcule pas de nouveaux sauf des écarts simples entre deux chiffres fournis. Pas de conseil fiscal définitif : signale ce qui mérite d'être vu avec l'expert-comptable.
Format : Markdown, sans titre de niveau 1. Trois sections courtes : « En bref » (3 puces), « Points d'attention » (2 à 5 puces), « Pistes » (2 à 3 puces concrètes pour une auto-école).`,
    messages: [{ role: "user", content: JSON.stringify({ mois: monthLabel(mois), synthese, mois_precedent: precedent, plus_grosses_depenses: top }) }],
  });
  assertUsable(response);
  return textOf(response).trim();
}

function analyseSimple(s, p) {
  const lines = ["### En bref", `- Chiffre d'affaires HT : ${eur(s.chiffre_affaires_ht)}, charges HT : ${eur(s.charges_ht)}.`, `- Résultat estimé : ${eur(s.resultat_estime_ht)}.`, `- Trésorerie du mois : ${s.variation_tresorerie >= 0 ? "+" : ""}${eur(s.variation_tresorerie)}.`];
  if (p) lines.push(`- Chiffre d'affaires HT le mois précédent : ${eur(p.chiffre_affaires_ht)}.`);
  lines.push("", "### Points d'attention");
  if (s.a_verifier) lines.push(`- ${s.a_verifier} opération(s) à classer ou vérifier dans le journal.`);
  lines.push(`- TVA nette estimée à déclarer : ${eur(s.tva_nette_estimee)} (à confirmer avec les factures).`);
  return lines.join("\n");
}

function renderReport(mois, s, p, analyse, txs, ai) {
  const delta = (k) => (p ? ` (${s[k] - p[k] >= 0 ? "+" : ""}${eur(round2(s[k] - p[k]))} vs mois précédent)` : "");
  const aVerifier = txs.filter((t) => t.categorie === "a_classer" || t.confiance === "faible");
  return `# Comptabilité de ${monthLabel(mois)}

> Rapport généré automatiquement le ${new Date().toLocaleDateString("fr-FR")} par l'agent comptable${ai ? " (Claude)" : " (règles, sans IA)"}.
> Document de pilotage : il ne remplace pas la tenue comptable ni la déclaration de TVA, à valider avec votre expert-comptable.

## Chiffres clés

| Indicateur | Montant |
|---|---:|
| Chiffre d'affaires HT | ${eur(s.chiffre_affaires_ht)}${delta("chiffre_affaires_ht")} |
| Charges HT | ${eur(s.charges_ht)}${delta("charges_ht")} |
| **Résultat estimé HT** | **${eur(s.resultat_estime_ht)}**${delta("resultat_estime_ht")} |
| Encaissements | ${eur(s.encaissements)} |
| Décaissements | ${eur(s.decaissements)} |
| Variation de trésorerie | ${eur(s.variation_tresorerie)} |
| TVA collectée | ${eur(s.tva_collectee)} |
| TVA déductible (estimée) | ${eur(s.tva_deductible_estimee)} |
| **TVA nette à déclarer (estimée)** | **${eur(s.tva_nette_estimee)}** |
| Masse salariale (salaires + charges) | ${eur(s.masse_salariale)} |
| Part du CPF dans les recettes | ${s.part_cpf.toLocaleString("fr-FR")} % |

## Analyse

${analyse}

## Détail par catégorie

| Catégorie | Compte | Opérations | TTC | HT | TVA |
|---|---|---:|---:|---:|---:|
${s.par_categorie.map((c) => `| ${c.libelle} | ${c.compte} | ${c.nb} | ${eur(c.ttc)} | ${eur(c.ht)} | ${eur(c.tva)} |`).join("\n")}

## Opérations à vérifier (${aVerifier.length})

${aVerifier.length ? `| Date | Libellé | Montant | Proposition |\n|---|---|---:|---|\n${aVerifier.map((t) => `| ${t.date} | ${t.libelle} | ${eur(t.montant)} | ${CATEGORIES[t.categorie].libelle}${t.justification ? ` (${t.justification})` : ""} |`).join("\n")}` : "Aucune : toutes les opérations ont été classées avec confiance."}

---
Fichiers : \`journal.csv\` (une ligne par opération, ouvrable dans Excel) et \`synthese.json\`.
`;
}
