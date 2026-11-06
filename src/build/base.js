// Préfixe les adresses absolues (« /formations.html », « /images/… ») par le chemin de
// base du site. Indispensable quand le site est servi dans un sous-dossier, comme sur
// GitHub Pages : https://<compte>.github.io/<dépôt>/
export function prefixBase(html, base) {
  if (!base || base === "/") return html;
  const fix = (url) => (url.startsWith("//") || url.startsWith(base) ? url : base + url.slice(1));
  return html
    .replace(/(\s(?:href|src|content|action|poster)=")(\/[^"]*)"/g, (_, attr, url) => `${attr}${fix(url)}"`)
    .replace(/("(?:image|url|logo)"\s*:\s*")(\/[^"]*)"/g, (_, key, url) => `${key}${fix(url)}"`);
}
