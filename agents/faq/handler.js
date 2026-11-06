// Point d'entrée HTTP de l'agent « Questions des élèves » (POST /api/chat).
// Standard Web Request/Response : fonctionne en fonction Netlify et dans le serveur Vite.
// La réponse est un flux SSE : `data: {"type":"delta","text":"…"}` puis `data: {"type":"done"}`.
import { getClient, hasApiKey, MODEL, FALLBACK } from "../lib/claude.js";
import { loadKnowledge, loadAnnonces, annoncesAsText, fallbackAnswer } from "./knowledge.js";
import { SYSTEM_PROMPT } from "./prompt.js";

const MAX_MESSAGES = 12;
const MAX_CHARS = 1500;
const RATE = { windowMs: 60_000, max: 12 };
const hits = new Map();

export function validateMessages(body) {
  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) return "Le champ messages est requis.";
  if (messages.length > MAX_MESSAGES * 2) return "Conversation trop longue.";
  for (const m of messages) {
    if (!m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string") return "Message invalide.";
    if (m.content.length > MAX_CHARS * 3) return "Message trop long.";
  }
  if (messages.at(-1).role !== "user") return "Le dernier message doit venir de l'utilisateur.";
  if (messages.at(-1).content.trim().length === 0) return "Question vide.";
  if (messages.at(-1).content.length > MAX_CHARS) return `Question trop longue (${MAX_CHARS} caractères maximum).`;
  return null;
}

/** Garde les derniers échanges et garantit l'alternance user/assistant attendue par l'API. */
function prepare(messages) {
  const recent = messages.slice(-MAX_MESSAGES);
  while (recent.length && recent[0].role !== "user") recent.shift();
  const merged = [];
  for (const m of recent) {
    const last = merged.at(-1);
    if (last && last.role === m.role) last.content += `\n\n${m.content}`;
    else merged.push({ role: m.role, content: m.content.slice(0, MAX_CHARS * 3) });
  }
  return merged;
}

function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE.windowMs);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > RATE.max;
}

const sse = (obj) => `data: ${JSON.stringify(obj)}\n\n`;
const json = (status, obj) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8" } });

export async function handleChat(request) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "POST") return json(405, { error: "Méthode non autorisée" });

  const ip = request.headers.get("x-nf-client-connection-ip") || request.headers.get("x-forwarded-for") || "local";
  if (rateLimited(ip)) return json(429, { error: "Trop de questions d'affilée, réessayez dans une minute." });

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "JSON invalide" });
  }
  const invalid = validateMessages(body);
  if (invalid) return json(400, { error: invalid });
  const messages = prepare(body.messages);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(encoder.encode(sse(obj)));
      try {
        if (!hasApiKey()) {
          send({ type: "delta", text: fallbackAnswer(messages.at(-1).content) });
        } else {
          await streamClaude(messages, send);
        }
        send({ type: "done" });
      } catch (err) {
        console.error("[copilote]", err);
        send({ type: "error", message: "Service momentanément indisponible." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}

async function streamClaude(messages, send) {
  const client = getClient();
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 2000,
    ...FALLBACK,
    // Questions simples : effort faible = réponses rapides et économiques.
    output_config: { effort: "low" },
    system: [
      // Bloc stable mis en cache (consignes + base de connaissances)
      { type: "text", text: `${SYSTEM_PROMPT}\n\n<base_de_connaissances>\n${loadKnowledge()}\n</base_de_connaissances>`, cache_control: { type: "ephemeral" } },
      // Bloc variable : annonces de la semaine
      { type: "text", text: `<annonces_de_la_semaine>\n${annoncesAsText(loadAnnonces())}\n</annonces_de_la_semaine>` },
    ],
    messages,
  });

  let sent = false;
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      send({ type: "delta", text: event.delta.text });
      sent = true;
    }
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal" || !sent) {
    send({
      type: "delta",
      text: "Je ne peux pas répondre à cette question. Pour toute demande, contactez l'agence au 04 74 62 38 62 ou à autoecole.autonome@gmail.com.",
    });
  }
}
