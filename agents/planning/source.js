// Lecture du planning : fichier CSV exporté du logiciel de gestion, ou agenda iCal
// (Google Agenda : « Adresse secrète au format iCal »).
import { readFile } from "node:fs/promises";
import { parseCSV, parseDate } from "../lib/csv.js";

export const TYPES = ["conduite", "code", "examen", "stage", "fermeture", "rendez-vous", "autre"];

/**
 * Événement normalisé :
 * { id, date:"AAAA-MM-JJ", debut:"HH:MM", fin:"HH:MM", type, titre, eleve, email, moniteur, statut:"confirmé"|"annulé", note }
 */
export function normalizeEvent(raw) {
  const type = guessType(raw.type || raw.titre || "");
  const statut = /annul|cancel/i.test(raw.statut || "") ? "annulé" : "confirmé";
  const ev = {
    id: (raw.id || raw.uid || "").trim(),
    date: parseDate(raw.date),
    debut: hhmm(raw.debut),
    fin: hhmm(raw.fin),
    type,
    titre: (raw.titre || "").trim() || defaultTitle(type),
    eleve: (raw.eleve || "").trim(),
    email: (raw.email || "").trim().toLowerCase(),
    moniteur: (raw.moniteur || "").trim(),
    statut,
    note: (raw.note || "").trim(),
  };
  if (!ev.id) ev.id = [ev.type, ev.eleve || ev.titre, ev.date, ev.debut].join("|").toLowerCase();
  return ev;
}

function guessType(s) {
  const t = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/conduite|lecon|heure de conduite/.test(t)) return "conduite";
  if (/examen|permis pratique|etg/.test(t)) return "examen";
  if (/stage/.test(t)) return "stage";
  if (/code/.test(t)) return "code";
  if (/ferme|fermeture|conge/.test(t)) return "fermeture";
  if (/rdv|rendez|bilan|evaluation/.test(t)) return "rendez-vous";
  return TYPES.includes(t) ? t : "autre";
}

const defaultTitle = (type) =>
  ({ conduite: "Leçon de conduite", code: "Cours de code", examen: "Examen", stage: "Stage", fermeture: "Fermeture de l'agence", "rendez-vous": "Rendez-vous pédagogique" })[type] || "Événement";

function hhmm(v) {
  const m = String(v ?? "").match(/(\d{1,2})[h:](\d{2})?/i);
  return m ? `${m[1].padStart(2, "0")}:${m[2] || "00"}` : "";
}

export async function loadCSV(path) {
  const rows = parseCSV(await readFile(path, "utf8"));
  return rows.map(normalizeEvent);
}

// --- iCal -----------------------------------------------------------------

export async function loadICS(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Agenda iCal inaccessible (HTTP ${res.status})`);
  return parseICS(await res.text());
}

/**
 * Convention pour Google Agenda :
 *  - titre de l'événement : « Conduite - Léa Martin » , « Code en salle », « Examen - Hugo B. », « Fermeture »
 *  - description (facultative), une info par ligne : « email: lea@exemple.fr », « moniteur: David », « note: … »
 */
export function parseICS(text) {
  const unfolded = text.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "");
  const events = [];
  for (const block of unfolded.split("BEGIN:VEVENT").slice(1)) {
    const body = block.split("END:VEVENT")[0];
    const get = (key) => {
      const m = body.match(new RegExp(`^${key}(?:;[^:\\n]*)?:(.*)$`, "m"));
      return m ? m[1].replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").trim() : "";
    };
    const start = parseICSDate(get("DTSTART"));
    const end = parseICSDate(get("DTEND"));
    if (!start) continue;
    const summary = get("SUMMARY");
    const desc = get("DESCRIPTION");
    const fields = Object.fromEntries(
      desc.split("\n").map((l) => l.match(/^\s*([a-zéè]+)\s*:\s*(.+)$/i)).filter(Boolean).map((m) => [m[1].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""), m[2].trim()]),
    );
    const [kind, ...rest] = summary.split(/\s+[-–—]\s+/);
    events.push(
      normalizeEvent({
        id: get("UID"),
        date: start.date,
        debut: start.time,
        fin: end?.time,
        type: fields.type || kind,
        titre: rest.length ? kind : summary,
        eleve: fields.eleve || rest.join(" - "),
        email: fields.email,
        moniteur: fields.moniteur || get("LOCATION"),
        statut: get("STATUS") === "CANCELLED" ? "annulé" : fields.statut,
        note: fields.note,
      }),
    );
  }
  return events;
}

function parseICSDate(v) {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
  if (!m) return null;
  if (!m[4]) return { date: `${m[1]}-${m[2]}-${m[3]}`, time: "" };
  if (m[7]) {
    // Heure UTC → heure de Paris
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
        .formatToParts(d)
        .map((p) => [p.type, p.value]),
    );
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
  }
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}` };
}
