import { readFileSync } from "node:fs";

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function loadAvis() {
  return JSON.parse(readFileSync(new URL("../../content/avis.json", import.meta.url), "utf8"));
}

const fmt = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/** Rendu statique (au build) de tout le livre d'or, pour le référencement. */
export function renderAvisList() {
  return loadAvis()
    .map(
      (a) => `<article class="avis-card reveal">
  <div class="avis-stars" aria-label="5 étoiles sur 5">★★★★★</div>
  <p>${esc(a.texte).replace(/\n/g, "<br>")}</p>
  <footer><strong>${esc(a.auteur)}</strong><time datetime="${a.date}">${fmt(a.date)}</time></footer>
</article>`,
    )
    .join("\n");
}
