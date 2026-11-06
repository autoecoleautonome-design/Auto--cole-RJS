// Dessin des panneaux routiers français sur <canvas> (utilisé en texture 3D).
// Chaque panneau est dessiné dans un carré de `size` px, fond transparent.

const ROUGE = "#d20a11";
const BLEU = "#1f4fb4";
const JAUNE = "#f6c400";
const NOIR = "#141414";
const BLANC = "#ffffff";

function polygon(ctx, cx, cy, r, sides, rotation = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i * 2 * Math.PI) / sides;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function roundedTriangle(ctx, s, down = false) {
  const m = s * 0.06;
  const top = down ? s - m * 1.6 : m * 1.6;
  const base = down ? m * 2.4 : s - m * 2.4;
  ctx.beginPath();
  ctx.moveTo(s / 2, top);
  ctx.lineTo(s - m, base);
  ctx.lineTo(m, base);
  ctx.closePath();
  ctx.lineJoin = "round";
}

const draw = {
  /** AB1 : intersection, priorité à droite (triangle + croix) */
  "priorite-droite"(ctx, s) {
    roundedTriangle(ctx, s);
    ctx.fillStyle = BLANC; ctx.fill();
    ctx.lineWidth = s * 0.09; ctx.strokeStyle = ROUGE; ctx.stroke();
    ctx.save(); ctx.translate(s / 2, s * 0.62); ctx.fillStyle = NOIR;
    ctx.rotate(Math.PI / 4); ctx.fillRect(-s * 0.045, -s * 0.2, s * 0.09, s * 0.4);
    ctx.rotate(Math.PI / 2); ctx.fillRect(-s * 0.045, -s * 0.2, s * 0.09, s * 0.4);
    ctx.restore();
  },
  /** AB3a : cédez le passage */
  "cedez-passage"(ctx, s) {
    roundedTriangle(ctx, s, true);
    ctx.fillStyle = BLANC; ctx.fill();
    ctx.lineWidth = s * 0.1; ctx.strokeStyle = ROUGE; ctx.stroke();
  },
  /** AB4 : stop */
  stop(ctx, s) {
    polygon(ctx, s / 2, s / 2, s * 0.47, 8, Math.PI / 8);
    ctx.fillStyle = ROUGE; ctx.fill();
    ctx.lineWidth = s * 0.025; ctx.strokeStyle = BLANC; ctx.stroke();
    ctx.fillStyle = BLANC; ctx.font = `800 ${s * 0.27}px "Barlow Condensed", Arial Narrow, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("STOP", s / 2, s / 2 + s * 0.02);
  },
  /** AB6 : route à caractère prioritaire */
  "route-prioritaire"(ctx, s) {
    polygon(ctx, s / 2, s / 2, s * 0.47, 4); ctx.fillStyle = BLANC; ctx.fill();
    ctx.lineWidth = s * 0.012; ctx.strokeStyle = "#999"; ctx.stroke();
    polygon(ctx, s / 2, s / 2, s * 0.3, 4); ctx.fillStyle = JAUNE; ctx.fill();
  },
  /** AB7 : fin de route prioritaire */
  "fin-prioritaire"(ctx, s) {
    draw["route-prioritaire"](ctx, s);
    ctx.save(); ctx.translate(s / 2, s / 2); ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = NOIR; ctx.fillRect(-s * 0.36, -s * 0.03, s * 0.72, s * 0.06); ctx.restore();
  },
  /** B14 : limitation de vitesse */
  "limite-50"(ctx, s) { speed(ctx, s, "50"); },
  "limite-30"(ctx, s) { speed(ctx, s, "30"); },
  "limite-80"(ctx, s) { speed(ctx, s, "80"); },
  /** B1 : sens interdit */
  "sens-interdit"(ctx, s) {
    ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.47, 0, Math.PI * 2); ctx.fillStyle = ROUGE; ctx.fill();
    ctx.fillStyle = BLANC; ctx.fillRect(s * 0.18, s * 0.42, s * 0.64, s * 0.16);
  },
  /** B6a1 : stationnement interdit */
  "stationnement-interdit"(ctx, s) {
    ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.47, 0, Math.PI * 2); ctx.fillStyle = ROUGE; ctx.fill();
    ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.37, 0, Math.PI * 2); ctx.fillStyle = BLEU; ctx.fill();
    ctx.save(); ctx.translate(s / 2, s / 2); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = ROUGE; ctx.fillRect(-s * 0.37, -s * 0.05, s * 0.74, s * 0.1); ctx.restore();
  },
  /** B6d : arrêt et stationnement interdits */
  "arret-interdit"(ctx, s) {
    draw["stationnement-interdit"](ctx, s);
    ctx.save(); ctx.translate(s / 2, s / 2); ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = ROUGE; ctx.fillRect(-s * 0.37, -s * 0.05, s * 0.74, s * 0.1); ctx.restore();
  },
  /** B21a1 : contournement obligatoire par la droite */
  "obligation-droite"(ctx, s) {
    ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.47, 0, Math.PI * 2); ctx.fillStyle = BLEU; ctx.fill();
    ctx.lineWidth = s * 0.02; ctx.strokeStyle = BLANC; ctx.stroke();
    ctx.save(); ctx.translate(s / 2, s / 2); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = BLANC;
    ctx.fillRect(-s * 0.05, -s * 0.12, s * 0.1, s * 0.34);
    ctx.beginPath(); ctx.moveTo(0, -s * 0.3); ctx.lineTo(s * 0.15, -s * 0.1); ctx.lineTo(-s * 0.15, -s * 0.1); ctx.closePath(); ctx.fill();
    ctx.restore();
  },
  /** Panneau de direction bleu « Villefranche » (hero) */
  direction(ctx, s, label = "Villefranche") {
    const h = s * 0.42, y = (s - h) / 2;
    ctx.fillStyle = BLEU; roundRect(ctx, s * 0.02, y, s * 0.96, h, s * 0.05); ctx.fill();
    ctx.lineWidth = s * 0.018; ctx.strokeStyle = BLANC; roundRect(ctx, s * 0.05, y + s * 0.03, s * 0.9, h - s * 0.06, s * 0.035); ctx.stroke();
    ctx.fillStyle = BLANC; ctx.font = `700 ${s * 0.13}px "Barlow Condensed", Arial Narrow, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, s / 2, s / 2);
  },
};

function speed(ctx, s, n) {
  ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.47, 0, Math.PI * 2); ctx.fillStyle = ROUGE; ctx.fill();
  ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.36, 0, Math.PI * 2); ctx.fillStyle = BLANC; ctx.fill();
  ctx.fillStyle = NOIR; ctx.font = `800 ${s * 0.34}px "Barlow Condensed", Arial Narrow, sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(n, s / 2, s / 2 + s * 0.02);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** Renvoie un canvas carré avec le panneau `type` dessiné dessus. */
export function signCanvas(type, size = 512, ...args) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  (draw[type] || draw.direction)(ctx, size, ...args);
  return c;
}

/** Silhouette grise (dos du panneau) de la même forme. */
export function signBackCanvas(type, size = 256) {
  const front = signCanvas(type, size);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.drawImage(front, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = "#8a8f99";
  ctx.fillRect(0, 0, size, size);
  return c;
}

export const SIGN_TYPES = Object.keys(draw);
