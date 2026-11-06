// Dates au format français, fuseau Europe/Paris.
const TZ = "Europe/Paris";

export const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** Date ISO (AAAA-MM-JJ) du jour à Paris. */
export function todayParis(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function dayOfWeek(iso) {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

/** Lundi de la semaine contenant `iso`. */
export function mondayOf(iso) {
  const dow = dayOfWeek(iso);
  return addDays(iso, dow === 0 ? -6 : 1 - dow);
}

/** Numéro de semaine ISO 8601 → "2026-S46" */
export function isoWeekLabel(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-S${String(week).padStart(2, "0")}`;
}

export function frDate(iso, opts = { weekday: "long", day: "numeric", month: "long" }) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", ...opts });
}

export function frDateTime(date = new Date()) {
  return date.toLocaleString("fr-FR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).replace(":", "h");
}

export function monthLabel(ym) {
  return new Date(`${ym}-15T12:00:00Z`).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function previousMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
