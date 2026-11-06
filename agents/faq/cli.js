#!/usr/bin/env node
// Tester le Copilote dans le terminal :  npm run agent:faq -- "Puis-je payer avec mon CPF ?"
import { handleChat } from "./handler.js";

process.stdout.on("error", (e) => { if (e.code === "EPIPE") process.exit(0); });

const question = process.argv.slice(2).join(" ").trim();
if (!question) {
  console.error('Usage : npm run agent:faq -- "votre question"');
  process.exit(1);
}

const res = await handleChat(
  new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: question }] }),
  }),
);
if (!res.ok) {
  console.error(await res.text());
  process.exit(1);
}
const reader = res.body.getReader();
const dec = new TextDecoder();
let buf = "";
for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  buf += dec.decode(value, { stream: true });
  const parts = buf.split("\n\n");
  buf = parts.pop();
  for (const p of parts) {
    const d = JSON.parse(p.replace(/^data:\s*/, ""));
    if (d.type === "delta") process.stdout.write(d.text);
    if (d.type === "error") console.error(`\n[erreur] ${d.message}`);
  }
}
process.stdout.write("\n");
