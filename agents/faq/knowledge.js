// Base de connaissances de l'agent « Questions des élèves ».
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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

// --- Mode sans IA : recherche par mots-clés dans la base -------------------

const STOP = new Set("le la les un une des de du d l a au aux et ou en pour par sur dans est sont je j tu il on nous vous ce cet cette ces mon ma mes mes votre vos que qui quoi quel quelle quels quelles comment combien quand est-ce ai peut peux puis faut faire avec sans pas ne y".split(" "));

const norm = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9€ ]+/g, " ");

const tokens = (s) => norm(s).split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)).map(stem);
const stem = (w) => w.replace(/(ements|ement|ations|ation|ages|age|es|s|x)$/, "");

/** Découpe la base en sections « titre + contenu ». */
export function sections(md = loadKnowledge()) {
  const out = [];
  let current = null;
  for (const line of md.split("\n")) {
    const h = line.match(/^#{2,3}\s+(.*)/);
    if (h) {
      if (current) out.push(current);
      current = { titre: h[1].replace(/^\d+\.\s*/, ""), lignes: [] };
    } else if (current && line.trim() && !line.startsWith(">")) current.lignes.push(line);
  }
  if (current) out.push(current);
  return out;
}

/** Réponse de secours : la section la plus pertinente, sans IA. */
export function fallbackAnswer(question) {
  const q = tokens(question);
  let best = null, bestScore = 0;
  for (const s of sections()) {
    const titre = tokens(s.titre);
    const corps = tokens(s.lignes.join(" "));
    let score = 0;
    for (const w of q) {
      if (titre.includes(w)) score += 3;
      score += corps.filter((c) => c === w).length;
    }
    if (score > bestScore) { bestScore = score; best = s; }
  }
  if (!best || bestScore < 2) {
    return "Je n'ai pas trouvé la réponse dans nos informations. Le plus simple est d'appeler l'agence au 04 74 62 38 62 (mardi à samedi) ou d'écrire à autoecole.autonome@gmail.com.";
  }
  const sep = (l) => /^\|[-\s|:]+\|$/.test(l);
  const body = best.lignes
    .filter((l, i, all) => !sep(l) && !sep(all[i + 1] || ""))
    .map((l) => l.replace(/\*\*/g, "").replace(/^\|\s*|\s*\|$/g, "").replace(/\s*\|\s*/g, " : "))
    .slice(0, 14)
    .join("\n");
  return `${best.titre}\n${body}\n\nPour toute précision : 04 74 62 38 62.`;
}
