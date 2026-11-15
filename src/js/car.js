// Berline de prestige modélisée par le code (aucun fichier 3D externe).
// La carrosserie est une surface « tendue » sur ~300 coupes transversales, calculées à
// partir de quelques profils : ligne de toit, ligne de caisse, bas de caisse, vue de dessus.
// Peinture deux tons : cuivre métallisé en bas, noir brillant en haut.
import * as THREE from "three";

// --- Dimensions (mètres) ----------------------------------------------------
export const L = 5.39; // longueur
const W2 = 0.975; // demi-largeur
const Z0 = -L / 2; // l'avant est du côté des z négatifs
const AXLES = [0.93, 4.14]; // position des essieux depuis l'avant
const WHEEL_R = 0.372;
const ARCH_R = 0.44;
const ARCH_Y = 0.36;
const NOSE = { d: 0.52, p: 2.8 }; // arrondi de l'avant en vue de dessus
const TAIL = { d: 0.5, p: 3 };

/** Courbe lisse sans dépassement passant par des points [x, y] (interpolation cubique monotone). */
function curve(keys) {
  const n = keys.length;
  const xs = keys.map((k) => k[0]);
  const ys = keys.map((k) => k[1]);
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m = [d[0]];
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], q = a * a + b * b;
    if (q > 9) { const t = 3 / Math.sqrt(q); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// Profils en fonction de s = distance depuis l'avant
const topY = curve([[0, 0.875], [0.025, 0.915], [0.09, 0.945], [0.4, 0.98], [1.0, 1.015], [1.7, 1.05], [1.8, 1.068], [2.58, 1.46], [2.9, 1.52], [3.2, 1.54], [3.7, 1.508], [4.0, 1.44], [4.62, 1.115], [4.78, 1.095], [5.2, 1.08], [5.34, 1.06], [L, 1.005]]);
const beltY = curve([[0, 0.815], [0.1, 0.87], [0.5, 0.935], [1.0, 0.972], [1.7, 1.0], [2.7, 1.022], [4.0, 1.024], [4.6, 1.022], [5.2, 1.015], [L, 0.965]]);
const baseY = curve([[0, 0.3], [0.05, 0.245], [0.25, 0.195], [0.6, 0.17], [4.6, 0.17], [5.1, 0.215], [5.33, 0.265], [L, 0.32]]);

function bottomY(s) {
  let y = baseY(s);
  for (const a of AXLES) {
    const dz = s - a;
    if (Math.abs(dz) < ARCH_R) y = Math.max(y, ARCH_Y + Math.sqrt(ARCH_R * ARCH_R - dz * dz));
  }
  return y;
}

function halfW(s) {
  let k = 1;
  if (s < NOSE.d) k = Math.pow(1 - Math.pow(1 - s / NOSE.d, NOSE.p), 1 / NOSE.p);
  else if (s > L - TAIL.d) k = Math.pow(1 - Math.pow(1 - (L - s) / TAIL.d, TAIL.p), 1 / TAIL.p);
  return W2 * k * (1 - 0.025 * ((s - 2.6) / 2.8) ** 2);
}

/** Galbe du flanc : facteur de largeur selon la hauteur. */
function barrel(y) {
  let f = 1 - 0.03 * ((y - 0.66) / 0.42) ** 2;
  if (y < 0.4) { const t = Math.min(1, (0.4 - y) / 0.25); f -= 0.035 * t * t * (3 - 2 * t); }
  return f;
}

/** Distance depuis l'extrémité (avant ou arrière) où la demi-largeur vaut x. */
function depthAt(x, rear) {
  const w = (d) => halfW(rear ? L - d : d);
  let lo = 0, hi = rear ? TAIL.d : NOSE.d;
  if (x >= w(hi)) return hi;
  for (let i = 0; i < 32; i++) { const mid = (lo + hi) / 2; if (w(mid) < x) lo = mid; else hi = mid; }
  return hi;
}

// --- Coupe transversale -------------------------------------------------------
const SIDE_N = 7;
// Nombre de subdivisions de chaque segment de la coupe, et sa « zone » de matière
const SEGMENTS = [
  ["floor", 1], ["floor", 2], ["sill", 3], ["sill", 2],
  ...Array.from({ length: SIDE_N - 1 }, () => ["side", 2]),
  ["side", 3], ["ledge", 3], ["ledge", 2], ["sideglass", 2], ["sideglass", 2], ["rail", 3], ["roof", 3], ["roof", 3],
];

function controlPoints(s) {
  const w = halfW(s), yb = bottomY(s), ys = beltY(s), yt = topY(s), h = yt - ys;
  const pts = [];
  const xs0 = w * barrel(yb);
  pts.push([0, yb], [0.55 * xs0, yb], [0.86 * xs0, yb], [0.955 * xs0, yb + 0.022]);
  const y0 = yb + 0.07, y1 = ys - 0.03;
  for (let j = 0; j < SIDE_N; j++) { const y = y0 + ((y1 - y0) * j) / (SIDE_N - 1); pts.push([w * barrel(y), y]); }
  pts.push([0.985 * w * barrel(ys), ys]); // arête de la ligne de caisse
  pts.push([0.945 * w, ys + Math.min(0.018, 0.35 * h)]);
  const gy = ys + Math.min(0.04, 0.7 * h); // bas du vitrage
  const glassX = (y) => w * (0.905 - (0.21 * (y - ys - 0.04)) / 0.46);
  const ry = Math.max(gy + 0.002, yt - 0.14 * h); // haut du vitrage latéral
  pts.push([0.905 * w, gy], [glassX((gy + ry) / 2), (gy + ry) / 2], [glassX(ry), ry]);
  const xr = glassX(ry);
  pts.push([0.86 * xr, yt - 0.05 * h], [0.5 * xr, yt - 0.01 * h], [0, yt]);
  return pts;
}

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/** Demi-coupe (côté droit) : liste de points [x, y] et zone de chaque segment. */
function halfSection(s) {
  const c = controlPoints(s);
  const out = [], zones = [];
  for (let i = 0; i < c.length - 1; i++) {
    const [zone, n] = SEGMENTS[i];
    const a = c[Math.max(0, i - 1)], b = c[i], d = c[i + 1], e = c[Math.min(c.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n;
      // Le plancher et les arêtes vives restent rectilignes
      const straight = zone === "floor";
      out.push(straight ? [b[0] + (d[0] - b[0]) * t, b[1] + (d[1] - b[1]) * t] : [catmull(a[0], b[0], d[0], e[0], t), catmull(a[1], b[1], d[1], e[1], t)]);
      zones.push(zone);
    }
  }
  out.push(c[c.length - 1]);
  return { pts: out, zones };
}

function stations() {
  const set = new Set([0, L]);
  const add = (v) => set.add(Math.min(L, Math.max(0, +v.toFixed(5))));
  for (let i = 0; i <= 230; i++) add((L * i) / 230);
  // Extrémités : stations réparties régulièrement en largeur, pour un arrondi lisse
  for (let j = 1; j <= 40; j++) { const x = W2 * 0.97 * (j / 40); add(depthAt(x, false)); add(L - depthAt(x, true)); }
  // Passages de roue : bords nets + arrondi régulier
  for (const a of AXLES) {
    add(a - ARCH_R - 0.001); add(a - ARCH_R + 0.0005); add(a + ARCH_R - 0.0005); add(a + ARCH_R + 0.001);
    for (let j = 1; j < 28; j++) add(a + ARCH_R * Math.cos((Math.PI * j) / 28));
  }
  // Limites des vitrages
  for (const v of Object.values(GLASS).flat()) add(v);
  return [...set].sort((a, b) => a - b);
}

const GLASS = { windshield: [1.86, 2.56], rear: [3.98, 4.58], sideFront: [2.04, 3.02], sideRear: [3.1, 4.2] };
const between = (s, [a, b]) => s >= a && s <= b;
const MAT = { paint: 0, black: 1, glass: 2, trim: 3, under: 4 };

function zoneMaterial(zone, s) {
  switch (zone) {
    case "floor": return MAT.under;
    case "sill": return s > AXLES[0] + ARCH_R && s < AXLES[1] - ARCH_R ? MAT.trim : MAT.paint;
    case "side": return MAT.paint;
    case "ledge": case "rail": return MAT.black;
    case "sideglass": return between(s, GLASS.sideFront) || between(s, GLASS.sideRear) ? MAT.glass : MAT.black;
    case "roof": return between(s, GLASS.windshield) || between(s, GLASS.rear) ? MAT.glass : MAT.black;
    default: return MAT.paint;
  }
}

function bodyGeometry() {
  const st = stations();
  const first = halfSection(0);
  const half = first.pts.length; // points de la demi-coupe (centre bas → centre haut)
  const ring = 2 * half - 1; // tour complet, le point bas central est dupliqué pour fermer
  const pos = new Float32Array(st.length * ring * 3);
  st.forEach((s, i) => {
    const { pts } = halfSection(s);
    const z = Z0 + s;
    for (let k = 0; k < ring; k++) {
      const right = k < half;
      const p = right ? pts[k] : pts[ring - 1 - k];
      const o = (i * ring + k) * 3;
      pos[o] = right ? p[0] : -p[0];
      pos[o + 1] = p[1];
      pos[o + 2] = z;
    }
  });
  const buckets = [[], [], [], [], []];
  for (let i = 0; i < st.length - 1; i++) {
    const sm = (st[i] + st[i + 1]) / 2;
    for (let k = 0; k < ring - 1; k++) {
      const seg = k < half - 1 ? k : ring - 2 - k;
      const mat = zoneMaterial(first.zones[seg], sm);
      const a = i * ring + k, b = a + 1, c = a + ring, d = c + 1;
      buckets[mat].push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const index = [];
  buckets.forEach((b, m) => { geo.addGroup(index.length, b.length, m); index.push(...b); });
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

// --- Petites surfaces posées sur la carrosserie ------------------------------
function patch(fn, nu, nv) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++)
    for (let i = 0; i <= nu; i++) {
      const p = fn(i / nu, j / nv);
      pos.push(p[0], p[1], p[2]);
      uv.push(i / nu, j / nv);
    }
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Bande épousant la face avant ou arrière, de x0 à x1 ; yLow/yHigh peuvent dépendre de la profondeur. */
function endBand(rear, x0, x1, yLow, yHigh, e = 0.006, nu = 28) {
  const f = (v, depth) => (typeof v === "function" ? v(depth) : v);
  return patch((u, v) => {
    // u inversé à l'avant pour que les textes se lisent dans le bon sens
    const x = rear ? x0 + (x1 - x0) * u : x1 + (x0 - x1) * u;
    const ax = Math.abs(x);
    const d0 = depthAt(ax, rear);
    const y = f(yLow, d0) + (f(yHigh, d0) - f(yLow, d0)) * v;
    const bx = Math.min(ax / barrel(y), W2 * 0.985);
    const d = depthAt(bx, rear);
    const slope = (depthAt(bx + 0.004, rear) - depthAt(Math.max(0, bx - 0.004), rear)) / 0.008;
    const n = Math.hypot(slope, 1);
    const px = (ax + (e * slope) / n) * Math.sign(x || 1);
    const pz = rear ? Z0 + L - d + e / n : Z0 + d - e / n;
    return [px, y, pz];
  }, nu, 2);
}

/** Rectangle posé sur le flanc droit (side = 1) ou gauche (side = -1). */
function sideBand(side, s0, s1, y0, y1, e = 0.004) {
  const f = (v, s) => (typeof v === "function" ? v(s) : v);
  return patch((u, v) => {
    const s = s0 + (s1 - s0) * u;
    const y = f(y0, s) + (f(y1, s) - f(y0, s)) * v;
    return [side * (halfW(s) * barrel(y) + e), y, Z0 + s];
  }, 6, 8);
}

function canvasTexture(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// --- Roue ---------------------------------------------------------------------
function makeWheel(mats) {
  const mount = new THREE.Group();
  const spin = new THREE.Group();
  spin.name = "spin";
  mount.add(spin);
  const R = WHEEL_R, hw = 0.132;
  const lathe = (pts, seg = 56) => { const g = new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg); g.rotateZ(-Math.PI / 2); return g; };
  // Pneu : flancs bombés, épaules arrondies
  spin.add(new THREE.Mesh(lathe([[0.272, -hw + 0.012], [0.3, -hw], [0.345, -hw + 0.004], [R - 0.008, -hw + 0.03], [R, -hw + 0.07], [R, hw - 0.07], [R - 0.008, hw - 0.03], [0.345, hw - 0.004], [0.3, hw], [0.272, hw - 0.012]]), mats.tyre));
  // Jante : rebord poli et fût sombre
  spin.add(new THREE.Mesh(lathe([[0.274, hw - 0.012], [0.268, hw - 0.004], [0.258, hw - 0.012], [0.252, hw - 0.03]]), mats.alloy));
  spin.add(new THREE.Mesh(lathe([[0.252, hw - 0.03], [0.245, -hw + 0.02], [0.272, -hw + 0.012]]), mats.barrel));
  // Disque et bâtons (5 paires en V)
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.195, 0.022, 40), mats.disc);
  disc.rotation.z = Math.PI / 2; disc.position.x = 0.02;
  spin.add(disc);
  const spoke = new THREE.BoxGeometry(0.03, 0.215, 0.034);
  spoke.translate(0, 0.148, 0);
  const back = new THREE.BoxGeometry(0.03, 0.215, 0.05);
  back.translate(-0.012, 0.148, 0);
  for (let i = 0; i < 5; i++)
    for (const off of [-0.2, 0.2]) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(spoke, mats.alloy), new THREE.Mesh(back, mats.barrel));
      g.rotation.x = (i * Math.PI * 2) / 5 + off;
      g.position.x = hw - 0.045;
      spin.add(g);
    }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.075, 0.05, 28), mats.barrel);
  hub.rotation.z = Math.PI / 2; hub.position.x = hw - 0.04;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.012, 24), mats.alloy);
  cap.rotation.z = Math.PI / 2; cap.position.x = hw - 0.012;
  spin.add(hub, cap);
  // Étrier de frein (fixe)
  const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.17), mats.caliper);
  caliper.position.set(0.045, 0.06, 0.175);
  caliper.rotation.x = -0.35;
  mount.add(caliper);
  return mount;
}

// --- Assemblage ---------------------------------------------------------------
export function makeCar() {
  const group = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: 0xc66a28, metalness: 0.72, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04 });
  const black = new THREE.MeshPhysicalMaterial({ color: 0x010101, metalness: 0, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0a1016, metalness: 0.9, roughness: 0.02, envMapIntensity: 1.25 });
  const trim = new THREE.MeshPhysicalMaterial({ color: 0x050506, metalness: 0.2, roughness: 0.22, clearcoat: 0.8 });
  const under = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.95 });
  const mats = {
    tyre: new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.82 }),
    alloy: new THREE.MeshStandardMaterial({ color: 0xd4d8de, metalness: 1, roughness: 0.32 }),
    barrel: new THREE.MeshStandardMaterial({ color: 0x0c0d0f, metalness: 0.6, roughness: 0.45 }),
    disc: new THREE.MeshStandardMaterial({ color: 0x6f7480, metalness: 0.9, roughness: 0.35 }),
    caliper: new THREE.MeshStandardMaterial({ color: 0x17181b, metalness: 0.4, roughness: 0.4 }),
  };

  group.add(new THREE.Mesh(bodyGeometry(), [paint, black, glass, trim, under]));

  // Passages de roue (fond sombre) et roues
  const wells = new THREE.CylinderGeometry(ARCH_R - 0.008, ARCH_R - 0.008, 1.74, 40);
  wells.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const a of AXLES) {
    const well = new THREE.Mesh(wells, under);
    well.position.set(0, ARCH_Y, Z0 + a);
    group.add(well);
    for (const side of [1, -1]) {
      const w = makeWheel(mats);
      w.position.set(side * 0.8, WHEEL_R, Z0 + a);
      if (side < 0) w.rotation.y = Math.PI;
      w.userData.dir = side;
      group.add(w);
      wheels.push(w);
    }
  }
  const belly = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 2.6), under);
  belly.position.set(0, 0.36, Z0 + 2.55);
  group.add(belly);

  const basic = (color) => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
  const decal = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, transparent: true, alphaTest: 0.5, roughness: 0.3, metalness: 0.3, side: THREE.DoubleSide, ...extra });
  const gloss = new THREE.MeshPhysicalMaterial({ color: 0x040405, metalness: 0.3, roughness: 0.18, clearcoat: 1, side: THREE.DoubleSide });
  const led = basic(0xf3f7ff);
  const red = basic(0xff1524);
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); group.add(m); return m; };

  // Face avant : calandre en deux parties, signature lumineuse, optiques basses, prises d'air, plaque
  const grille = canvasTexture(256, 400, (ctx, w, h) => {
    roundRect(ctx, 8, 8, w - 16, h - 16, 54);
    ctx.fillStyle = "#040405"; ctx.fill();
    ctx.save(); ctx.clip();
    for (let i = 0; i < 7; i++) {
      const x = 30 + i * 30;
      const g = ctx.createLinearGradient(x, 0, x + 14, 0);
      g.addColorStop(0, "#0c0d10"); g.addColorStop(0.5, "#2b2e35"); g.addColorStop(1, "#0a0b0d");
      ctx.fillStyle = g; ctx.fillRect(x, 0, 14, h);
    }
    ctx.restore();
    ctx.lineWidth = 6; ctx.strokeStyle = "#aeb4be"; ctx.stroke();
  });
  const grilleMat = decal(grille, { metalness: 0.6, roughness: 0.25 });
  add(endBand(false, 0.02, 0.44, 0.345, 0.8, 0.008, 10), grilleMat);
  add(endBand(false, -0.44, -0.02, 0.345, 0.8, 0.008, 10), grilleMat);
  const drlY = (d) => beltY(d) - 0.058;
  for (const s of [1, -1]) {
    add(endBand(false, s * 0.5, s * 0.955, drlY, (d) => drlY(d) + 0.026, 0.007), led);
    add(endBand(false, s * 0.52, s * 0.9, (d) => 0.585 + d * 0.12, (d) => 0.7 + d * 0.12, 0.006), gloss);
    add(endBand(false, s * 0.6, s * 0.68, (d) => 0.622 + d * 0.12, (d) => 0.662 + d * 0.12, 0.009, 4), led);
    add(endBand(false, s * 0.56, s * 0.93, (d) => 0.3 + d * 0.05, (d) => 0.46 + d * 0.1, 0.006), gloss);
  }
  add(endBand(false, -0.42, 0.42, 0.262, 0.325, 0.005, 12), gloss);
  const plate = canvasTexture(512, 112, (ctx, w, h) => {
    roundRect(ctx, 2, 2, w - 4, h - 4, 12); ctx.fillStyle = "#f4f4f1"; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = "#111"; ctx.stroke();
    ctx.fillStyle = "#1e3f9c"; roundRect(ctx, 6, 6, 44, h - 12, 8); ctx.fill(); roundRect(ctx, w - 50, 6, 44, h - 12, 8); ctx.fill();
    ctx.fillStyle = "#111"; ctx.font = "700 70px 'Inter Tight', Arial, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("AUTONOME", w / 2, h / 2 + 4);
  });
  const plateMat = decal(plate, { metalness: 0, roughness: 0.5 });
  add(endBand(false, -0.26, 0.26, 0.385, 0.498, 0.014, 8), plateMat);

  // Face arrière : feux fins, bandeau sombre, plaque
  for (const s of [1, -1]) {
    add(endBand(true, s * 0.3, s * 0.955, (d) => 0.885 + d * 0.1, (d) => 0.918 + d * 0.1, 0.007), red);
    add(endBand(true, s * 0.34, s * 0.93, (d) => 0.845 + d * 0.1, (d) => 0.858 + d * 0.1, 0.007), red);
  }
  add(endBand(true, -0.82, 0.82, 0.36, 0.48, 0.006, 24), gloss);
  add(endBand(true, -0.26, 0.26, 0.6, 0.713, 0.01, 8), plateMat);

  // Flancs : jointures de portes, poignées affleurantes, rétroviseurs
  const seam = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
  for (const side of [1, -1]) {
    for (const s of [1.82, 3.06, 4.06]) add(sideBand(side, s - 0.004, s + 0.004, (x) => bottomY(x) + 0.075, (x) => beltY(x) - 0.012, 0.0025), seam);
    for (const s of [2.74, 3.86]) add(sideBand(side, s, s + 0.2, 0.9, 0.922, 0.004), gloss);
    add(sideBand(side, 1.46, 1.68, 0.71, 0.735, 0.004), gloss);
    const mirror = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), black);
    mirror.scale.set(0.105, 0.062, 0.075);
    mirror.position.set(side * (halfW(2.1) * 0.905 + 0.1), beltY(2.1) + 0.085, Z0 + 2.1);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.05), black);
    arm.position.set(side * (halfW(2.1) * 0.905 + 0.02), beltY(2.1) + 0.05, Z0 + 2.1);
    group.add(mirror, arm);
  }

  // Enseigne de toit lumineuse
  const signTex = canvasTexture(512, 140, (ctx, w, h) => {
    ctx.fillStyle = "#f6f6f4"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#e30613"; ctx.font = "800 82px 'Inter Tight', Arial, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("AUTO-ÉCOLE", w / 2, h / 2 + 4);
  });
  const face = new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.3, roughness: 0.4 });
  const shell = new THREE.MeshStandardMaterial({ color: 0xf2f2f0, emissive: 0xffffff, emissiveIntensity: 0.12, roughness: 0.4 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.15, 0.16), [shell, shell, shell, shell, face, face]);
  sign.position.set(0, topY(3.1) + 0.085, Z0 + 3.1);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.2), black);
  foot.position.set(0, topY(3.1) + 0.005, Z0 + 3.1);
  group.add(sign, foot);

  return { group, wheels };
}
