// Envoi d'e-mails par SMTP (ex. Gmail avec mot de passe d'application).
// Sans configuration SMTP ou sans --envoyer, les messages sont seulement écrits sur disque.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/**
 * @param {{to:string, subject:string, text:string}[]} messages
 * @param {{dir:string, send:boolean}} options
 */
export async function deliver(messages, { dir, send }) {
  await mkdir(dir, { recursive: true });
  const results = [];
  let transport = null;
  if (send && smtpConfigured()) {
    const nodemailer = await import("nodemailer");
    transport = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  for (const [i, m] of messages.entries()) {
    const file = join(dir, `${String(i + 1).padStart(3, "0")}-${slug(m.to)}.txt`);
    await writeFile(file, `À : ${m.to}\nObjet : ${m.subject}\n\n${m.text}`);
    if (transport) {
      await transport.sendMail({
        from: process.env.SMTP_FROM || `Auto-École Autonome <${process.env.SMTP_USER}>`,
        to: m.to,
        subject: m.subject,
        text: m.text,
      });
      results.push({ to: m.to, status: "envoyé" });
    } else results.push({ to: m.to, status: "brouillon", file });
  }
  return results;
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
