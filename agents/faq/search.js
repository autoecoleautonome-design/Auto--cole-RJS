// Recherche par mots-clés dans la base de connaissances (sans IA).
// Module sans dépendance Node : utilisé par le serveur ET directement dans le navigateur
// quand le site est hébergé sans fonction serveur (GitHub Pages).

// --- Mode sans IA : recherche par mots-clés dans la base -------------------

const STOP = new Set("le la les un une des de du d l a au aux et ou en pour par sur dans est sont je j tu il on nous vous ce cet cette ces mon ma mes mes votre vos que qui quoi quel quelle quels quelles comment combien quand est-ce ai peut peux puis faut faire avec sans pas ne y".split(" "));

const norm = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9€ ]+/g, " ");

const tokens = (s) => norm(s).split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)).map(stem);
const stem = (w) => w.replace(/(ements|ement|ations|ation|ages|age|es|s|x)$/, "");

/** Découpe la base en sections « titre + contenu ». */
export function sections(md) {
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
export function fallbackAnswer(question, md) {
  const q = tokens(question);
  let best = null, bestScore = 0;
  for (const s of sections(md)) {
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
