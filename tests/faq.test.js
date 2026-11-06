import { test } from "node:test";
import assert from "node:assert/strict";
import { fallbackAnswer, sections } from "../agents/faq/knowledge.js";
import { handleChat, validateMessages } from "../agents/faq/handler.js";

test("la base de connaissances est découpée en sections", () => {
  const titres = sections().map((s) => s.titre);
  assert.ok(titres.some((t) => /Horaires/.test(t)));
  assert.ok(titres.some((t) => /CPF/.test(t)));
});

test("réponse de secours pertinente sans IA", () => {
  assert.match(fallbackAnswer("Quels documents pour l'inscription ?"), /e-photo/);
  assert.match(fallbackAnswer("Puis-je payer avec mon CPF ?"), /Qualiopi/);
  assert.match(fallbackAnswer("xyzzy plugh"), /04 74 62 38 62/);
});

test("validation des messages", () => {
  assert.ok(validateMessages({}));
  assert.ok(validateMessages({ messages: [{ role: "assistant", content: "x" }] }));
  assert.ok(validateMessages({ messages: [{ role: "user", content: "x".repeat(2000) }] }));
  assert.equal(validateMessages({ messages: [{ role: "user", content: "Bonjour" }] }), null);
});

test("handleChat renvoie un flux SSE (mode sans clé)", async () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  const res = await handleChat(new Request("http://x/api/chat", { method: "POST", body: JSON.stringify({ messages: [{ role: "user", content: "horaires du bureau" }] }) }));
  if (saved) process.env.ANTHROPIC_API_KEY = saved;
  assert.equal(res.headers.get("content-type"), "text/event-stream; charset=utf-8");
  const text = await res.text();
  assert.match(text, /"type":"delta"/);
  assert.match(text, /"type":"done"/);
  const bad = await handleChat(new Request("http://x/api/chat", { method: "GET" }));
  assert.equal(bad.status, 405);
});

test("CORS : seule une origine autorisée reçoit les en-têtes", async () => {
  process.env.ALLOWED_ORIGINS = "https://autoecoleautonome-design.github.io";
  const ok = await handleChat(new Request("http://x/api/chat", { method: "OPTIONS", headers: { origin: "https://autoecoleautonome-design.github.io" } }));
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get("access-control-allow-origin"), "https://autoecoleautonome-design.github.io");
  const ko = await handleChat(new Request("http://x/api/chat", { method: "OPTIONS", headers: { origin: "https://pirate.example" } }));
  assert.equal(ko.headers.get("access-control-allow-origin"), null);
  delete process.env.ALLOWED_ORIGINS;
});
