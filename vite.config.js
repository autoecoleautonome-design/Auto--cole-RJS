import { defineConfig } from "vite";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { renderAvisList } from "./src/build/avis.js";

const root = dirname(fileURLToPath(import.meta.url));

// Toutes les pages .html à la racine sont des points d'entrée (site multi-pages).
const pages = Object.fromEntries(
  readdirSync(root)
    .filter((f) => f.endsWith(".html"))
    .map((f) => [basename(f, ".html"), resolve(root, f)]),
);

/**
 * Remplace les marqueurs <!-- @include nom --> par src/partials/nom.html
 * et marque le lien de navigation de la page courante (aria-current).
 */
function partials() {
  return {
    name: "autonome-partials",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        const page = basename(ctx.filename || ctx.path || "index.html", ".html");
        const include = /<!--\s*@include\s+([\w-]+)\s*-->/g;
        let out = html;
        // Boucle : un partial peut en inclure un autre (footer → chat).
        for (let i = 0; i < 5 && include.test(out); i++) {
          out = out.replace(include, (_, name) =>
            readFileSync(resolve(root, "src/partials", `${name}.html`), "utf8"),
          );
        }
        out = out.replace(/<!--\s*@avis-list\s*-->/g, () => renderAvisList());
        // Emplacements photo : <figure class="media is-empty" data-photo="nom.jpg">.
        // Si public/images/site/nom.jpg existe, la photo est insérée ; sinon le dégradé reste.
        out = out.replace(/<figure class="media is-empty"([^>]*?)data-photo="([^"]+)"([^>]*)><\/figure>/g, (m, a, file, b) =>
          existsSync(resolve(root, "public/images/site", file))
            ? `<figure class="media"${a}data-photo="${file}"${b}><img src="/images/site/${file}" alt="" loading="lazy" /></figure>`
            : m,
        );
        out = out.replace(
          new RegExp(`(<a[^>]*data-page="${page}")`, "g"),
          '$1 aria-current="page"',
        );
        return out;
      },
    },
  };
}

/**
 * En développement, sert /api/chat avec le même gestionnaire que la fonction
 * Netlify (agents/faq/handler.js), réponses en streaming comprises.
 */
function apiDev() {
  return {
    name: "autonome-api-dev",
    configureServer(server) {
      server.middlewares.use("/api/chat", async (req, res) => {
        const { handleChat } = await server.ssrLoadModule("/agents/faq/handler.js");
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const request = new Request(`http://localhost${req.originalUrl}`, {
          method: req.method,
          headers: req.headers,
          body: req.method === "POST" ? Buffer.concat(chunks) : undefined,
        });
        const response = await handleChat(request);
        res.statusCode = response.status;
        response.headers.forEach((v, k) => res.setHeader(k, v));
        if (!response.body) return res.end();
        const reader = response.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      });
    },
  };
}

export default defineConfig({
  plugins: [partials(), apiDev()],
  build: {
    rollupOptions: { input: pages },
    chunkSizeWarningLimit: 900,
  },
});
