// Accès partagé à l'API Claude pour tous les agents.
import Anthropic from "@anthropic-ai/sdk";

/** Modèle utilisé par défaut (surchargeable avec la variable CLAUDE_MODEL). */
export const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";

/**
 * Bascule automatique vers un autre modèle si une requête est refusée par les
 * filtres de sécurité (paramètre `fallbacks` côté serveur).
 */
export const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };

/** Vrai si une clé d'API est configurée. Sans clé, les agents passent en mode « règles » sans IA. */
export function hasApiKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let client;
export function getClient() {
  client ??= new Anthropic({ maxRetries: 3 });
  return client;
}

/** Concatène les blocs texte d'une réponse. */
export function textOf(message) {
  return message.content.filter((b) => b.type === "text").map((b) => b.text).join("");
}

/** Lève une erreur claire si la réponse a été refusée ou tronquée. */
export function assertUsable(message) {
  if (message.stop_reason === "refusal") {
    throw new Error(`Réponse refusée par le modèle (${message.stop_details?.category ?? "sans catégorie"}).`);
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("Réponse tronquée (max_tokens atteint).");
  }
  return message;
}
