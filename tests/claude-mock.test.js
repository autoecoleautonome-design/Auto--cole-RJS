// Vérifie les chemins « avec IA » sans appeler l'API : fetch est remplacé par une fausse API
// qui enregistre les requêtes envoyées par le SDK et renvoie des réponses factices.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.ANTHROPIC_API_KEY = "sk-ant-test";
const requests = [];
let nextReply = () => "{}";

const message = (text) => ({
  id: "msg_test", type: "message", role: "assistant", model: "claude-opus-5-5",
  content: [{ type: "text", text }], stop_reason: "end_turn", stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 10 },
});

globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body);
  requests.push({ url: String(url), body, headers: init.headers });
  const text = nextReply(body);
  if (body.stream) {
    const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
    const m = message("");
    m.content = [];
    const sse =
      ev("message_start", { message: m }) +
      ev("content_block_start", { index: 0, content_block: { type: "text", text: "" } }) +
      ev("content_block_delta", { index: 0, delta: { type: "text_delta", text } }) +
      ev("content_block_stop", { index: 0 }) +
      ev("message_delta", { delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 5 } }) +
      ev("message_stop", {});
    return new Response(sse, { status: 200, headers: { "content-type": "text/event-stream", "request-id": "req_test" } });
  }
  return new Response(JSON.stringify(message(text)), { status: 200, headers: { "content-type": "application/json", "request-id": "req_test" } });
};

const { handleChat } = await import("../agents/faq/handler.js");
const { runPlanning } = await import("../agents/planning/index.js");
const { loadCSV } = await import("../agents/planning/source.js");
const { runCompta } = await import("../agents/compta/index.js");

const betaHeader = (h) => (h instanceof Headers ? h.get("anthropic-beta") : new Headers(h).get("anthropic-beta"));

test("Copilote : requête en streaming avec cache, effort et repli", async () => {
  requests.length = 0;
  nextReply = () => "Oui, le CPF est accepté.";
  const res = await handleChat(new Request("http://x/api/chat", { method: "POST", body: JSON.stringify({ messages: [{ role: "user", content: "CPF ?" }] }) }));
  const text = await res.text();
  assert.match(text, /le CPF est accepté/);
  const r = requests[0];
  assert.match(r.url, /\/v1\/messages/);
  assert.equal(r.body.model, "claude-opus-5-5");
  assert.equal(r.body.stream, true);
  assert.equal(r.body.fallbacks, "default");
  assert.match(betaHeader(r.headers), /server-side-fallback-2026-07-01/);
  assert.deepEqual(r.body.output_config, { effort: "low" });
  assert.equal(r.body.system[0].cache_control.type, "ephemeral");
  assert.match(r.body.system[0].text, /248 rue de la République/);
  assert.equal(r.body.thinking, undefined);
});

test("Planning : sortie structurée (schéma JSON) et annonces publiées", async () => {
  requests.length = 0;
  nextReply = () => JSON.stringify({ resume: "Semaine courte : agence fermée mercredi.", annonces: [{ type: "changement", titre: "Code déplacé au jeudi", texte: "Le cours a lieu jeudi 12 novembre de 17h à 19h." }], brief_equipe: "## Points d'attention\n- Recaser Inès P." });
  const dir = await mkdtemp(join(tmpdir(), "pl-ia-"));
  const events = await loadCSV("exemples/planning-v2.csv");
  const r = await runPlanning({ events, mode: "recap", today: "2026-11-09", snapshotPath: join(dir, "e.json"), outDir: dir, publicPath: join(dir, "a.json") });
  const body = requests[0].body;
  assert.equal(body.output_config.format.type, "json_schema");
  assert.ok(body.output_config.format.schema.properties.annonces);
  assert.equal(r.publicData.annonces[0].titre, "Code déplacé au jeudi");
  assert.match(await readFile(join(r.dir, "brief-equipe.md"), "utf8"), /Recaser/);
  // Les e-mails des élèves ne sont jamais envoyés à l'IA
  assert.ok(!JSON.stringify(body).includes("@exemple.fr"));
});

test("Compta : classement IA des opérations inconnues puis analyse", async () => {
  requests.length = 0;
  nextReply = (body) => {
    if (body.output_config?.format) {
      const ops = JSON.parse(body.messages[0].content.split("\n").slice(1).join("\n"));
      return JSON.stringify({ classements: ops.map((o) => ({ id: o.id, categorie: o.montant > 0 ? "recette_eleves" : "fournitures", confiance: "moyenne", justification: "test" })) });
    }
    return "### En bref\n- Mois correct.";
  };
  const dir = await mkdtemp(join(tmpdir(), "cp-ia-"));
  const r = await runCompta({ mois: "2026-10", releve: "exemples/releve-2026-10.csv", outDir: dir });
  assert.equal(requests.length, 2, "1 appel de classement + 1 appel d'analyse");
  assert.equal(r.txs.filter((t) => t.source === "IA").length, 1, "seule « CB MOTOMAG SAS » est inconnue des règles");
  assert.equal(r.synthese.a_verifier, 0);
  assert.match(r.rapport, /Mois correct/);
});
