// Point d'entrée commun à toutes les pages.
import { initSliders, Slider } from "./slider.js";
import { initCopilote } from "./chat.js";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// Menu mobile
const toggle = $("[data-nav-toggle]");
const nav = $("#nav");
toggle?.addEventListener("click", () => {
  const open = toggle.getAttribute("aria-expanded") !== "true";
  toggle.setAttribute("aria-expanded", String(open));
  nav.classList.toggle("is-open", open);
});

// Barre de progression façon route
const progress = $(".road-progress");
const onScroll = () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  progress?.style.setProperty("--p", max > 0 ? (scrollY / max).toFixed(4) : 0);
};
addEventListener("scroll", onScroll, { passive: true });
onScroll();

$$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

// Hero 3D (chargé à la demande pour ne pas ralentir la page)
const heroCanvas = $("[data-hero3d]");
if (heroCanvas && webglOK()) {
  import("./hero3d.js")
    .then(({ initHero3D }) => initHero3D(heroCanvas, { reducedMotion: reduced }))
    .catch((e) => console.warn("3D indisponible", e));
}

// Cartes inclinables en 3D au survol (formations)
if (!reduced && matchMedia("(hover: hover)").matches) {
  $$("[data-tilt]").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(900px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`;
    });
    card.addEventListener("pointerleave", () => (card.style.transform = ""));
  });
}

// Avis : remplissage du slider depuis le livre d'or
const avisTrack = $("[data-avis-track]");
if (avisTrack) {
  import("../../content/avis.json").then(({ default: avis }) => {
    const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    avisTrack.innerHTML = avis
      .slice(0, 18)
      .map(
        (a) => `<article class="avis-card"><div class="avis-stars" aria-label="5 étoiles sur 5">★★★★★</div>
        <p>${esc(a.texte)}</p><footer><strong>${esc(a.auteur)}</strong>
        <time datetime="${a.date}">${new Date(a.date).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</time></footer></article>`,
      )
      .join("");
    new Slider(avisTrack.closest(".slider"));
  });
}

initSliders();

// Parcours de formation (étapes cliquables + voiture qui avance)
const parcours = $("[data-parcours]");
if (parcours) initParcours(parcours);

// Code du jour
const quiz = $("[data-quiz]");
if (quiz) import("./quiz.js").then(({ initQuiz }) => initQuiz(quiz));

// Annonces de la semaine (générées par l'agent planning)
$$("[data-annonces]").forEach(renderAnnonces);

// Carte (page contact)
const map = $("[data-map]");
if (map) {
  const io = new IntersectionObserver(async ([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    const [{ default: L }] = await Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]);
    const pos = [45.9865982, 4.7165593];
    const m = L.map(map, { scrollWheelZoom: false }).setView(pos, 16);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    L.circleMarker(pos, { radius: 12, color: "#fff", weight: 3, fillColor: "#e30613", fillOpacity: 1 })
      .addTo(m)
      .bindPopup("<strong>Auto-École Autonome</strong><br>248 rue de la République")
      .openPopup();
  });
  io.observe(map);
}

// Formulaire de contact (Netlify Forms, avec repli e-mail)
const form = $("[data-contact-form]");
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = $("[data-form-status]", form);
  const data = new FormData(form);
  try {
    const res = await fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(data).toString(),
    });
    if (!res.ok) throw new Error();
    form.reset();
    status.textContent = "Message envoyé. L'équipe vous répond sous 48 h ouvrées.";
  } catch {
    const body = `${data.get("message")}\n\n${data.get("nom")} ${data.get("telephone") || ""}`;
    location.href = `mailto:autoecole.autonome@gmail.com?subject=${encodeURIComponent(data.get("objet") || "Demande")}&body=${encodeURIComponent(body)}`;
    status.textContent = "Votre messagerie s'ouvre pour envoyer le message.";
  }
});

const copilote = $("[data-copilote]");
if (copilote) initCopilote(copilote);

// ---------------------------------------------------------------------------

function webglOK() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function initParcours(root) {
  const steps = $$("[data-step]", root);
  const car = $(".parcours__car", root);
  const detail = $("[data-parcours-detail]", root);
  let current = 0;
  let auto = !reduced;

  const select = (i, fromUser) => {
    current = i;
    if (fromUser) auto = false;
    steps.forEach((s, k) => (k === i ? s.setAttribute("aria-current", "step") : s.removeAttribute("aria-current")));
    const tpl = $(`template[data-for="${steps[i].dataset.step}"]`, root);
    detail.replaceChildren(tpl.content.cloneNode(true));
    if (car) {
      const r = steps[i].getBoundingClientRect();
      const pr = root.getBoundingClientRect();
      car.style.left = `${r.left - pr.left + 6}px`;
    }
  };
  steps.forEach((s, i) => $("button", s).addEventListener("click", () => select(i, true)));
  addEventListener("resize", () => select(current));
  select(0);
  const io = new IntersectionObserver(([e]) => { root.dataset.visible = e.isIntersecting ? "1" : ""; });
  io.observe(root);
  setInterval(() => {
    if (auto && root.dataset.visible && !document.hidden) select((current + 1) % steps.length);
  }, 4500);
}

async function renderAnnonces(root) {
  try {
    const res = await fetch("/data/annonces.json", { cache: "no-cache" });
    if (!res.ok) throw new Error();
    const data = await res.json();
    const limit = Number(root.dataset.limit || 99);
    const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const items = (data.annonces || []).slice(0, limit);
    root.innerHTML = `
      ${data.resume ? `<p class="lead">${esc(data.resume)}</p>` : ""}
      <div class="annonces">${
        items.length
          ? items.map((a) => `<article class="annonce ${a.type === "changement" ? "" : "annonce--info"}"><h3>${esc(a.titre)}</h3><p>${esc(a.texte)}</p></article>`).join("")
          : `<article class="annonce annonce--info"><h3>Aucun changement cette semaine</h3><p>Les horaires habituels s'appliquent.</p></article>`
      }</div>
      <p class="annonces__meta">Semaine du ${esc(data.semaine?.debut_fr || "")} au ${esc(data.semaine?.fin_fr || "")}, mis à jour le ${esc(data.genere_le_fr || "")}.</p>`;
    const table = $("[data-semaine]");
    if (table && data.evenements?.length) {
      table.innerHTML = `<div class="table-wrap"><table class="semaine"><thead><tr><th>Jour</th><th>Horaire</th><th>Événement</th><th>Statut</th></tr></thead><tbody>${data.evenements
        .map((e) => `<tr><td>${esc(e.jour)}</td><td>${esc(e.horaire)}</td><td>${esc(e.titre)}</td><td>${e.statut === "annulé" ? '<span class="cartouche cartouche--red">Annulé</span>' : e.statut === "modifié" ? '<span class="cartouche cartouche--yellow">Modifié</span>' : "Confirmé"}</td></tr>`)
        .join("")}</tbody></table></div>`;
    }
  } catch {
    root.innerHTML = `<p>Le planning de la semaine sera publié lundi matin. Pour toute question : 04 74 62 38 62.</p>`;
  }
}
