// Agent « Planning de la semaine »
//  - mode "recap" (lundi matin) : récapitulatif complet de la semaine
//  - mode "changements" (chaque soir) : seulement ce qui a bougé depuis le dernier passage
// Sorties : annonces publiques du site, brief de l'équipe, e-mails personnels aux élèves.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { getClient, hasApiKey, MODEL, FALLBACK, assertUsable } from "../lib/claude.js";
import { addDays, mondayOf, todayParis, frDate, frDateTime, isoWeekLabel, JOURS, dayOfWeek } from "../lib/dates.js";
import { deliver } from "../lib/mail.js";
import { diffPlanning, changesFor, isPublic } from "./diff.js";

const AnnoncesSchema = z.object({
  resume: z.string().describe("1 ou 2 phrases pour le site, sans aucun nom d'élève"),
  annonces: z
    .array(
      z.object({
        type: z.enum(["changement", "info"]),
        titre: z.string().describe("Titre court, 3 à 8 mots"),
        texte: z.string().describe("1 à 2 phrases, sans nom d'élève"),
      }),
    )
    .describe("Annonces publiques : changements d'abord, puis infos utiles. 0 à 5 éléments."),
  brief_equipe: z.string().describe("Brief interne en Markdown pour Soraya et les enseignants"),
});

const h = (t) => t.replace(/^0?(\d+):00$/, "$1h").replace(/^0?(\d+):(\d+)$/, "$1h$2");
const fmtSlot = (e) => `${frDate(e.date)}${e.debut ? ` de ${h(e.debut)}` : ""}${e.fin ? ` à ${h(e.fin)}` : ""}`;
const dot = (s) => (s && !/[.!?]$/.test(s) ? `${s}.` : s);
const prenom = (e) => {
  const [first, last] = (e.eleve || "").split(/\s+/);
  return first ? `${first}${last ? ` ${last[0]}.` : ""}` : "";
};

/**
 * @param {object} o
 * @param {object[]} o.events       planning actuel (normalisé, voir source.js)
 * @param {"recap"|"changements"} o.mode
 * @param {string} [o.today]        AAAA-MM-JJ (par défaut : aujourd'hui à Paris)
 * @param {string} o.snapshotPath   état précédent (JSON)
 * @param {string} o.outDir         dossier des sorties privées
 * @param {string} o.publicPath     fichier annonces.json du site
 * @param {boolean} [o.send]        envoyer réellement les e-mails
 * @param {boolean} [o.ai]          utiliser Claude (par défaut si une clé est configurée)
 */
export async function runPlanning(o) {
  const today = o.today || todayParis();
  // Le lundi matin on traite la semaine en cours ; le dimanche, la semaine suivante.
  const monday = dayOfWeek(today) === 0 ? addDays(today, 1) : mondayOf(today);
  const sunday = addDays(monday, 6);
  const windowEnd = o.mode === "recap" ? sunday : addDays(today, 14);
  const windowStart = o.mode === "recap" ? monday : today;
  const inWindow = (e) => e.date >= windowStart && e.date <= windowEnd;

  const events = o.events.filter(inWindow).sort((a, b) => (a.date + a.debut).localeCompare(b.date + b.debut));
  const previous = existsSync(o.snapshotPath) ? JSON.parse(await readFile(o.snapshotPath, "utf8")).events.filter(inWindow) : null;
  const diff = previous ? diffPlanning(previous, events) : { ajoutes: [], annules: [], deplaces: [], modifies: [], total: 0 };
  const week = events.filter((e) => e.date >= monday && e.date <= sunday);

  // --- Données agrégées et anonymes -------------------------------------
  const actifs = week.filter((e) => e.statut !== "annulé");
  const stats = {
    lecons: actifs.filter((e) => e.type === "conduite").length,
    examens: actifs.filter((e) => e.type === "examen").length,
    cours_code: actifs.filter((e) => e.type === "code").length,
    annulations: week.filter((e) => e.statut === "annulé").length,
    eleves: new Set(actifs.filter((e) => e.email || e.eleve).map((e) => e.email || e.eleve)).size,
    par_moniteur: Object.entries(
      actifs.filter((e) => e.type === "conduite").reduce((acc, e) => ((acc[e.moniteur || "?"] = (acc[e.moniteur || "?"] || 0) + 1), acc), {}),
    ).map(([moniteur, lecons]) => ({ moniteur, lecons })),
  };
  const evenements = week.filter(isPublic).map((e) => {
    const changed = diff.deplaces.find((d) => d.apres.id === e.id);
    return {
      jour: `${JOURS[dayOfWeek(e.date)]} ${frDate(e.date, { day: "numeric", month: "long" })}`,
      date: e.date,
      horaire: e.debut ? `${h(e.debut)}–${h(e.fin)}` : "Toute la journée",
      titre: e.titre,
      statut: e.statut === "annulé" ? "annulé" : changed ? "modifié" : "confirmé",
      note: e.note,
    };
  });
  const changementsPublics = [
    ...diff.annules.filter(isPublic).map((e) => ({ quoi: "annulé", titre: e.titre, quand: fmtSlot(e), note: e.note })),
    ...diff.deplaces.filter((d) => isPublic(d.apres)).map((d) => ({ quoi: "déplacé", titre: d.apres.titre, avant: fmtSlot(d.avant), apres: fmtSlot(d.apres), note: d.apres.note })),
    ...diff.ajoutes.filter(isPublic).map((e) => ({ quoi: "ajouté", titre: e.titre, quand: fmtSlot(e), note: e.note })),
  ];

  // --- Rédaction (Claude, ou modèle de texte sans IA) ---------------------
  const useAI = o.ai ?? hasApiKey();
  const contexte = {
    mode: o.mode,
    semaine: { du: frDate(monday), au: frDate(sunday) },
    statistiques: stats,
    evenements_collectifs: evenements,
    changements_collectifs: changementsPublics,
    changements_individuels: {
      ajoutes: diff.ajoutes.filter((e) => !isPublic(e)).map((e) => ({ type: e.type, eleve: prenom(e), moniteur: e.moniteur, quand: fmtSlot(e) })),
      annules: diff.annules.filter((e) => !isPublic(e)).map((e) => ({ type: e.type, eleve: prenom(e), moniteur: e.moniteur, quand: fmtSlot(e) })),
      deplaces: diff.deplaces.filter((d) => !isPublic(d.apres)).map((d) => ({ type: d.apres.type, eleve: prenom(d.apres), moniteur: d.apres.moniteur, avant: fmtSlot(d.avant), apres: fmtSlot(d.apres) })),
    },
    examens: actifs.filter((e) => e.type === "examen").map((e) => ({ eleve: prenom(e), quand: fmtSlot(e), moniteur: e.moniteur })),
    planning_moniteurs: Object.groupBy
      ? Object.fromEntries(Object.entries(Object.groupBy(actifs.filter((e) => e.type === "conduite"), (e) => e.moniteur || "?")).map(([m, l]) => [m, l.map((e) => `${fmtSlot(e)} : ${prenom(e)}`)]))
      : {},
  };
  const redaction = useAI ? await writeWithClaude(contexte) : writeWithTemplate(contexte);

  // --- Sorties -------------------------------------------------------------
  const label = isoWeekLabel(monday);
  const dir = join(o.outDir, label, o.mode === "recap" ? "recap" : `changements-${today}`);
  await mkdir(dir, { recursive: true });

  const publicData = {
    semaine: { debut: monday, fin: sunday, debut_fr: frDate(monday), fin_fr: frDate(sunday), label },
    genere_le: new Date().toISOString(),
    genere_le_fr: frDateTime(),
    genere_par: useAI ? "agent IA (Claude)" : "agent planning (modèle de texte)",
    resume: redaction.resume,
    annonces: redaction.annonces,
    evenements,
  };
  // En mode "changements", on ne republie le site que si un événement collectif a bougé.
  const publish = o.mode === "recap" || changementsPublics.length > 0;
  if (publish && o.publicPath) {
    await mkdir(dirname(o.publicPath), { recursive: true });
    await writeFile(o.publicPath, JSON.stringify(publicData, null, 2) + "\n");
  }
  await writeFile(join(dir, "brief-equipe.md"), redaction.brief_equipe + "\n");
  await writeFile(join(dir, "changements.json"), JSON.stringify(diff, null, 2));

  const emails = buildStudentEmails({ events: week.concat(events.filter((e) => e.date > sunday)), diff, mode: o.mode, monday, sunday, hadSnapshot: !!previous });
  const envoi = await deliver(emails, { dir: join(dir, "emails"), send: !!o.send });
  if (process.env.PLANNING_EQUIPE_EMAIL) {
    envoi.push(...(await deliver([{ to: process.env.PLANNING_EQUIPE_EMAIL, subject: `Planning ${label} : brief de l'équipe`, text: redaction.brief_equipe }], { dir: join(dir, "emails-equipe"), send: !!o.send })));
  }

  // Le planning actuel devient la référence du prochain passage
  await mkdir(dirname(o.snapshotPath), { recursive: true });
  await writeFile(o.snapshotPath, JSON.stringify({ enregistre_le: new Date().toISOString(), events: o.events }, null, 2));

  return { dir, publie: publish, publicData, diff, stats, emails: envoi };
}

// ---------------------------------------------------------------------------

async function writeWithClaude(contexte) {
  const client = getClient();
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    ...FALLBACK,
    output_config: { effort: "medium", format: betaZodOutputFormat(AnnoncesSchema) },
    system: `Tu es l'assistant de planning de l'Auto-École Autonome (Villefranche-sur-Saône). Tu rédiges en français, ton clair et chaleureux.
Règles :
- Le résumé et les annonces sont publiés sur le site : n'y mets jamais de nom d'élève ni d'information personnelle. Parle des événements collectifs (cours de code du mercredi, stages, fermetures, horaires) et des chiffres agrégés si utile (« 3 élèves passent l'examen cette semaine »).
- Commence les annonces par les changements (type "changement"), puis les informations utiles (type "info"). Pas d'annonce inutile : s'il n'y a rien à signaler, une seule annonce "info" suffit.
- Utilise uniquement les dates et horaires fournis. N'invente rien.
- Le brief de l'équipe est interne : Markdown, sections courtes (Points d'attention, Examens, Changements, Charge par enseignant). Signale les journées chargées, les annulations à recaser et les examens à préparer.`,
    messages: [{ role: "user", content: `Voici les données du planning (JSON) :\n${JSON.stringify(contexte, null, 2)}` }],
  });
  assertUsable(response);
  if (!response.parsed_output) throw new Error("Réponse de l'agent planning illisible.");
  return response.parsed_output;
}

function writeWithTemplate(c) {
  const annonces = [];
  for (const ch of c.changements_collectifs) {
    const note = ch.note ? ` ${dot(cap(ch.note))}` : "";
    if (ch.quoi === "annulé") annonces.push({ type: "changement", titre: `${ch.titre} annulé`, texte: `${cap(ch.quand)} : la séance n'aura pas lieu.${note}` });
    if (ch.quoi === "déplacé") annonces.push({ type: "changement", titre: `${ch.titre} déplacé`, texte: `Prévu ${ch.avant}, il a lieu ${ch.apres}.${note}` });
    if (ch.quoi === "ajouté") annonces.push({ type: "changement", titre: ch.titre, texte: `${cap(ch.quand)}.${note}` });
  }
  const dejaAnnonce = new Set(c.changements_collectifs.map((x) => x.titre));
  for (const e of c.evenements_collectifs.filter((e) => e.statut === "confirmé" && e.note && !dejaAnnonce.has(e.titre))) {
    annonces.push({ type: "info", titre: e.titre, texte: `${cap(e.jour)}, ${e.horaire.toLowerCase()} : ${dot(e.note)}` });
  }
  if (!annonces.length) annonces.push({ type: "info", titre: "Semaine sans changement", texte: "Les horaires habituels de l'agence et des cours de code s'appliquent." });
  const s = c.statistiques;
  const nb = c.changements_collectifs.length;
  const resume = `Au programme cette semaine : ${s.lecons} leçons de conduite${s.examens ? ` et ${s.examens} passage${s.examens > 1 ? "s" : ""} d'examen` : ""}.${nb ? ` ${nb} changement${nb > 1 ? "s" : ""} concerne${nb > 1 ? "nt" : ""} l'agence ou les cours collectifs, détaillé${nb > 1 ? "s" : ""} ci-dessous.` : " Aucun changement sur les horaires habituels."}`;
  const ind = c.changements_individuels;
  const brief = [
    `# Planning du ${c.semaine.du} au ${c.semaine.au}`,
    "",
    `- Leçons de conduite : ${s.lecons}`,
    `- Examens : ${s.examens}`,
    `- Annulations : ${s.annulations}`,
    `- Élèves concernés : ${s.eleves}`,
    "",
    "## Charge par enseignant",
    ...s.par_moniteur.map((m) => `- ${m.moniteur} : ${m.lecons} leçon(s)`),
    "",
    "## Examens",
    ...(c.examens.length ? c.examens.map((e) => `- ${e.quand} : ${e.eleve}${e.moniteur ? ` (${e.moniteur})` : ""}`) : ["- Aucun"]),
    "",
    "## Changements depuis le dernier passage",
    ...[...ind.annules.map((e) => `- Annulé : ${e.type} ${e.eleve}, ${e.quand}`), ...ind.deplaces.map((d) => `- Déplacé : ${d.type} ${d.eleve}, ${d.avant} → ${d.apres}`), ...ind.ajoutes.map((e) => `- Ajouté : ${e.type} ${e.eleve}, ${e.quand}`), ...c.changements_collectifs.map((x) => `- ${cap(x.quoi)} : ${x.titre}`)],
  ];
  if (brief.at(-1).startsWith("## Changements")) brief.push("- Aucun");
  return { resume, annonces, brief_equipe: brief.join("\n") };
}

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** E-mails personnels, rédigés à partir des données exactes (pas d'IA : aucun risque d'erreur d'horaire). */
export function buildStudentEmails({ events, diff, mode, monday, sunday, hadSnapshot }) {
  const byEmail = new Map();
  for (const e of events) if (e.email && !isPublic(e)) (byEmail.get(e.email) || byEmail.set(e.email, []).get(e.email)).push(e);
  for (const d of diff.annules) if (d.email && !byEmail.has(d.email)) byEmail.set(d.email, []);

  const out = [];
  for (const [email, list] of byEmail) {
    const ch = changesFor(diff, email);
    const nbChanges = ch.ajoutes.length + ch.annules.length + ch.deplaces.length + ch.modifies.length;
    if (mode === "changements" && (nbChanges === 0 || !hadSnapshot)) continue;
    const semaine = list.filter((e) => e.date >= monday && e.date <= sunday && e.statut !== "annulé");
    if (mode === "recap" && semaine.length === 0 && nbChanges === 0) continue;
    const name = (list[0]?.eleve || diff.annules.find((x) => x.email === email)?.eleve || "").split(/\s+/)[0];

    const lines = [`Bonjour${name ? ` ${name}` : ""},`, ""];
    if (nbChanges && hadSnapshot) {
      lines.push("Votre planning a changé :");
      for (const d of ch.deplaces) lines.push(`  • ${label(d.apres)} déplacée : ${fmtSlot(d.avant)} → ${fmtSlot(d.apres)}`);
      for (const e of ch.annules) lines.push(`  • ${label(e)} du ${fmtSlot(e)} annulée${e.note ? ` (${e.note})` : ""}`);
      for (const e of ch.ajoutes) lines.push(`  • Nouveau : ${label(e).toLowerCase()} ${fmtSlot(e)}${e.moniteur ? ` avec ${e.moniteur}` : ""}`);
      for (const d of ch.modifies) lines.push(`  • ${label(d.apres)} du ${fmtSlot(d.apres)} : ${d.apres.moniteur ? `avec ${d.apres.moniteur}` : ""} ${d.apres.note}`.trimEnd());
      lines.push("");
    }
    if (mode === "recap") {
      lines.push(semaine.length ? "Vos rendez-vous cette semaine :" : "Vous n'avez pas de rendez-vous cette semaine.");
      for (const e of semaine) lines.push(`  • ${cap(fmtSlot(e))} : ${label(e).toLowerCase()}${e.moniteur ? ` avec ${e.moniteur}` : ""}${e.note ? ` (${e.note})` : ""}`);
      lines.push("");
    }
    lines.push(
      "Rendez-vous au parking privé de l'agence, 248 rue de la République.",
      "Un empêchement ? Prévenez-nous au moins 48 heures ouvrées à l'avance : 04 74 62 38 62 ou en répondant à ce message.",
      "",
      "Bonne route,",
      "L'équipe de l'Auto-École Autonome",
    );
    out.push({
      to: email,
      subject: mode === "recap" ? `Vos leçons de la semaine du ${frDate(monday, { day: "numeric", month: "long" })}` : "Changement dans votre planning de conduite",
      text: lines.join("\n"),
    });
  }
  return out;
}

const label = (e) => ({ conduite: "Leçon de conduite", examen: "Examen", "rendez-vous": "Rendez-vous" })[e.type] || e.titre;
