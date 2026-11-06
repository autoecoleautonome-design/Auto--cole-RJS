import { test } from "node:test";
import assert from "node:assert/strict";
import { prefixBase } from "../src/build/base.js";

test("prefixBase ajoute le sous-dossier GitHub Pages aux liens internes", () => {
  const html = `<a href="/formations.html#aac">x</a><img src="/images/a.jpg"><a href="tel:+33">t</a>
<a href="https://ex.fr/a">e</a><script src="/Auto--cole-RJS/assets/i.js"></script><meta property="og:image" content="/images/v.jpg">
<link href="//fonts.googleapis.com/x"><script type="application/ld+json">{"image": "/images/v.jpg"}</script><a href="/">accueil</a>`;
  const out = prefixBase(html, "/Auto--cole-RJS/");
  assert.match(out, /href="\/Auto--cole-RJS\/formations\.html#aac"/);
  assert.match(out, /src="\/Auto--cole-RJS\/images\/a\.jpg"/);
  assert.match(out, /src="\/Auto--cole-RJS\/assets\/i\.js"/, "pas de double préfixe");
  assert.match(out, /content="\/Auto--cole-RJS\/images\/v\.jpg"/);
  assert.match(out, /"image": "\/Auto--cole-RJS\/images\/v\.jpg"/);
  assert.match(out, /href="\/Auto--cole-RJS\/"/);
  assert.match(out, /href="tel:\+33"/);
  assert.match(out, /href="\/\/fonts\.googleapis\.com\/x"/);
  assert.equal(prefixBase(html, "/"), html);
});
