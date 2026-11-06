// Comparaison de deux versions du planning : ce qui a été ajouté, annulé ou déplacé.

const sameSlot = (a, b) => a.date === b.date && a.debut === b.debut && a.fin === b.fin;
const person = (e) => (e.email || e.eleve || e.titre).toLowerCase();

/**
 * @param {object[]} before  planning précédent (snapshot)
 * @param {object[]} after   planning actuel
 */
export function diffPlanning(before, after) {
  const prev = new Map(before.map((e) => [e.id, e]));
  const next = new Map(after.map((e) => [e.id, e]));
  const ajoutes = [], annules = [], deplaces = [], modifies = [];

  for (const [id, e] of next) {
    const old = prev.get(id);
    if (!old) { ajoutes.push(e); continue; }
    if (old.statut !== "annulé" && e.statut === "annulé") annules.push(e);
    else if (!sameSlot(old, e)) deplaces.push({ avant: old, apres: e });
    else if (old.moniteur !== e.moniteur || old.note !== e.note) modifies.push({ avant: old, apres: e });
  }
  const supprimes = [...prev.values()].filter((e) => !next.has(e.id) && e.statut !== "annulé");

  // Un événement supprimé + un ajouté pour la même personne et le même type = déplacement
  for (const s of [...supprimes]) {
    const i = ajoutes.findIndex((a) => a.type === s.type && person(a) === person(s));
    if (i !== -1) {
      deplaces.push({ avant: s, apres: ajoutes[i] });
      ajoutes.splice(i, 1);
      supprimes.splice(supprimes.indexOf(s), 1);
    }
  }
  annules.push(...supprimes.map((e) => ({ ...e, statut: "annulé" })));

  const total = ajoutes.length + annules.length + deplaces.length + modifies.length;
  return { ajoutes, annules, deplaces, modifies, total };
}

/** Changements qui concernent un élève donné (par e-mail). */
export function changesFor(diff, email) {
  const mine = (e) => e.email && e.email === email;
  return {
    ajoutes: diff.ajoutes.filter(mine),
    annules: diff.annules.filter(mine),
    deplaces: diff.deplaces.filter((d) => mine(d.apres) || mine(d.avant)),
    modifies: diff.modifies.filter((d) => mine(d.apres)),
  };
}

/** Événements collectifs (publiables) : tout sauf les leçons et rendez-vous individuels. */
export const isPublic = (e) => ["code", "stage", "fermeture"].includes(e.type);
