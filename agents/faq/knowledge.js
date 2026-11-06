// Base de connaissances de l'agent « Questions des élèves ».
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { sections as searchSections, fallbackAnswer as searchAnswer } from "./search.js";

const here = dirname(fileURLToPath(import.meta.url));

/** Cherche un fichier du dépôt, en local comme dans une fonction Netlify (included_files). */
function findFile(rel) {
  const candidates = [resolve(here, "../..", rel), resolve(process.cwd(), rel), resolve("/var/task", rel)];
  return candidates.find((p) => existsSync(p));
}

let cache;
export function loadKnowledge() {
  if (cache) return cache;
  const kbPath = findFile("content/connaissances.md");
  if (!kbPath) throw new Error("content/connaissances.md introuvable");
  cache = readFileSync(kbPath, "utf8");
  return cache;
}

/** Annonces publiques de la semaine (générées par l'agent planning), ou null. */
export function loadAnnonces() {
  const p = findFile("public/data/annonces.json");
  if (!p) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

export function annoncesAsText(a) {
  if (!a) return "Aucune annonce publiée cette semaine.";
  const lines = [`Semaine du ${a.semaine?.debut_fr} au ${a.semaine?.fin_fr}. ${a.resume ?? ""}`];
  for (const x of a.annonces ?? []) lines.push(`- ${x.titre} : ${x.texte}`);
  for (const e of a.evenements ?? []) lines.push(`- ${e.jour} ${e.horaire} : ${e.titre} (${e.statut})`);
  return lines.join("\n");
}

// --- Mode sans IA : recherche par mots-clés (voir search.js) ---------------

export const sections = (md = loadKnowledge()) => searchSections(md);
export const fallbackAnswer = (question, md = loadKnowledge()) => searchAnswer(question, md);
