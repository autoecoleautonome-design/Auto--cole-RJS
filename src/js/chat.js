// Widget « Le Copilote » : discute avec l'agent IA (POST /api/chat, réponse en streaming SSE).

const STORE = "copilote-historique";
// Adresse de l'agent IA. Par défaut la fonction du site (Netlify) ; sur un hébergement
// statique (GitHub Pages), on peut pointer vers une fonction hébergée ailleurs avec
// VITE_CHAT_API. Si elle ne répond pas, le Copilote répond depuis la base locale.
const API = import.meta.env.VITE_CHAT_API || `${import.meta.env.BASE_URL}api/chat`;
let apiDown = false;

/** Réponse sans serveur : recherche dans la base de connaissances embarquée. */
async function localAnswer(question) {
  const [{ fallbackAnswer }, { default: md }] = await Promise.all([
    import("../../agents/faq/search.js"),
    import("../../content/connaissances.md?raw"),
  ]);
  return fallbackAnswer(question, md);
}
const MAX_TURNS = 12;

export function initCopilote(root) {
  const toggle = root.querySelector("[data-copilote-toggle]");
  const panel = root.querySelector("#copilote-panel");
  const close = root.querySelector("[data-copilote-close]");
  const log = root.querySelector("[data-copilote-log]");
  const form = root.querySelector("[data-copilote-form]");
  const input = form.querySelector("input");
  const chips = root.querySelector("[data-copilote-chips]");
  let history = load();
  let busy = false;

  history.forEach((m) => bubble(m.role === "user" ? "user" : "bot", m.content));

  const open = (state) => {
    panel.hidden = !state;
    toggle.setAttribute("aria-expanded", String(state));
    if (state) input.focus();
  };
  toggle.addEventListener("click", () => open(panel.hidden));
  close.addEventListener("click", () => { open(false); toggle.focus(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) { open(false); toggle.focus(); } });
  document.querySelectorAll("[data-open-copilote]").forEach((b) =>
    b.addEventListener("click", (e) => { e.preventDefault(); open(true); }),
  );

  chips.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) ask(b.textContent.replace(/ /g, " "));
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (q) ask(q);
  });

  async function ask(question) {
    if (busy) return;
    busy = true;
    input.value = "";
    chips.hidden = true;
    bubble("user", question);
    history.push({ role: "user", content: question });
    const out = bubble("bot", "");
    out.classList.add("msg--typing");
    let text = "";
    try {
      if (apiDown) throw new Error("API indisponible");
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-MAX_TURNS) }),
      });
      if (!res.ok || !res.body || !(res.headers.get("content-type") || "").includes("event-stream")) {
        if (res.status !== 429) apiDown = true;
        throw new Error(`HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop();
        for (const ev of events) {
          const line = ev.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          const data = JSON.parse(line.slice(5));
          if (data.type === "delta") { text += data.text; out.textContent = text; log.scrollTop = log.scrollHeight; }
          if (data.type === "error") throw new Error(data.message);
        }
      }
      if (!text) throw new Error("Réponse vide");
      history.push({ role: "assistant", content: text });
      save();
    } catch {
      try {
        if (text) throw new Error("réponse partielle");
        text = await localAnswer(question);
        out.textContent = text;
        history.push({ role: "assistant", content: text });
        save();
      } catch {
        history.pop();
        out.textContent =
          "Le Copilote est momentanément indisponible. Appelez l'agence au 04 74 62 38 62 ou écrivez à autoecole.autonome@gmail.com.";
      }
    } finally {
      out.classList.remove("msg--typing");
      busy = false;
    }
  }

  function bubble(kind, text) {
    const d = document.createElement("div");
    d.className = `msg msg--${kind}`;
    d.textContent = text;
    log.append(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }

  function load() {
    try { return JSON.parse(sessionStorage.getItem(STORE)) || []; } catch { return []; }
  }
  function save() {
    try { sessionStorage.setItem(STORE, JSON.stringify(history.slice(-MAX_TURNS))); } catch { /* stockage indisponible */ }
  }
}
