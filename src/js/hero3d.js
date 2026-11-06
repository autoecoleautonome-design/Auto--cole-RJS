// Scène 3D de la page d'accueil : la voiture rouge de l'auto-école roule de nuit
// sur une route de Villefranche. Three.js, chargé à la demande.
import * as THREE from "three";
import { signCanvas, signBackCanvas } from "./signs.js";

const ROAD_LEN = 260;
const LANE = 3.6;

export function initHero3D(canvas, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x1a1d2b, 30, 150);
  scene.background = skyTexture();

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);

  // Lumières : lune froide + ambiance chaude des lampadaires
  scene.add(new THREE.HemisphereLight(0x8fa3ff, 0x2a1d1d, 0.55));
  const moon = new THREE.DirectionalLight(0xb9c6ff, 0.9);
  moon.position.set(-30, 40, -20);
  scene.add(moon);

  // Sol et route
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, ROAD_LEN * 2),
    new THREE.MeshStandardMaterial({ color: 0x1b2420, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  scene.add(ground);

  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(LANE * 2 + 2, ROAD_LEN * 2),
    new THREE.MeshStandardMaterial({ color: 0x24262c, roughness: 0.85, metalness: 0.05 }),
  );
  road.rotation.x = -Math.PI / 2;
  scene.add(road);

  // Bandes de rive continues
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, emissive: 0x555555 });
  for (const x of [-LANE - 0.6, LANE + 0.6]) {
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.16, ROAD_LEN * 2), edgeMat);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(x, 0.01, 0);
    scene.add(edge);
  }

  // Ligne médiane discontinue (instanciée, défile)
  const DASHES = 60;
  const dashGap = 9;
  const dashes = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.18, 3),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x888888 }),
    DASHES,
  );
  dashes.rotation.x = -Math.PI / 2;
  scene.add(dashes);

  // Lampadaires (poteaux + ampoules émissives) et arbres, recyclés en boucle
  const props = new THREE.Group();
  scene.add(props);
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 6, 6);
  const armGeo = new THREE.BoxGeometry(1.6, 0.08, 0.08);
  const bulbGeo = new THREE.SphereGeometry(0.22, 12, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, metalness: 0.6, roughness: 0.4 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  const glowTex = glowTexture();
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffb760, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const treeGeo = new THREE.ConeGeometry(1.4, 4.5, 7);
  const treeMat = new THREE.MeshStandardMaterial({ color: 0x15322a, roughness: 1, flatShading: true });

  const movers = [];
  const spacing = 26;
  for (let i = 0; i < ROAD_LEN / spacing; i++) {
    const side = i % 2 ? 1 : -1;
    const lamp = new THREE.Group();
    const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.y = 3; lamp.add(pole);
    const arm = new THREE.Mesh(armGeo, poleMat); arm.position.set(-side * 0.75, 5.95, 0); lamp.add(arm);
    const bulb = new THREE.Mesh(bulbGeo, bulbMat); bulb.position.set(-side * 1.45, 5.8, 0); lamp.add(bulb);
    const glow = new THREE.Sprite(glowMat); glow.scale.set(5, 5, 1); glow.position.copy(bulb.position); lamp.add(glow);
    lamp.position.set(side * (LANE + 2.2), 0, -i * spacing);
    props.add(lamp); movers.push(lamp);

    for (let t = 0; t < 3; t++) {
      const tree = new THREE.Mesh(treeGeo, treeMat);
      const s = 0.7 + Math.random() * 0.9;
      tree.scale.set(s, s, s);
      tree.position.set(side * (LANE + 6 + Math.random() * 14), 2.2 * s, -i * spacing - Math.random() * spacing);
      props.add(tree); movers.push(tree);
    }
  }

  // Panneaux de signalisation sur le bas-côté
  const signTypes = ["limite-50", "priorite-droite", "direction", "cedez-passage", "limite-30", "route-prioritaire"];
  signTypes.forEach((type, i) => {
    const sign = makeSign(type, type === "direction" ? 2.6 : 1.3);
    sign.position.set(LANE + 1.6, 0, -40 - i * 42);
    sign.rotation.y = -0.25;
    props.add(sign); movers.push(sign);
  });

  // Silhouette de la ville au loin (fenêtres éclairées)
  const city = new THREE.Group();
  const winTex = windowsTexture();
  for (let i = 0; i < 46; i++) {
    const w = 4 + Math.random() * 7, h = 6 + Math.random() * 26, d = 4 + Math.random() * 6;
    const tex = winTex.clone(); tex.needsUpdate = true; tex.repeat.set(w / 4, h / 4);
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: 0x141722, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.9, roughness: 1 }),
    );
    const x = (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 110);
    b.position.set(x, h / 2, -150 - Math.random() * 60);
    city.add(b);
  }
  scene.add(city);

  // La voiture de l'auto-école
  const car = makeCar();
  scene.add(car.group);

  // Lumière d'appoint (reflets sur la carrosserie rouge)
  const rim = new THREE.PointLight(0xffd0a0, 30, 14, 1.6);
  rim.position.set(-2.5, 3.2, 3.5);
  car.group.add(rim);
  const fill = new THREE.PointLight(0x8fa8ff, 18, 12, 1.6);
  fill.position.set(2.5, 2.5, -1);
  car.group.add(fill);

  // Phares : deux spots qui éclairent la route devant la voiture
  const beams = [-0.62, 0.62].map((x) => {
    const spot = new THREE.SpotLight(0xfff1d6, 60, 45, 0.45, 0.6, 1.4);
    spot.position.set(x, 0.75, -2.1);
    spot.target.position.set(x * 1.5, 0, -18);
    car.group.add(spot, spot.target);
    return spot;
  });
  void beams;

  // --- Animation ---------------------------------------------------------
  const clock = new THREE.Timer();
  const tmp = new THREE.Matrix4();
  let distance = 0;
  let speed = 16; // m/s simulés
  let scroll = 0;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let running = true;
  let raf = 0;

  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 700 ? 55 : 42;
    camera.updateProjectionMatrix();
  }

  function frame() {
    clock.update();
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.getElapsed();
    distance += speed * dt;

    // Défilement des éléments (la voiture reste au centre, le monde avance)
    for (let i = 0; i < DASHES; i++) {
      const z = ((i * dashGap + distance) % (DASHES * dashGap)) - DASHES * dashGap + 30;
      dashes.setMatrixAt(i, tmp.makeTranslation(0, -z, 0.012));
    }
    dashes.instanceMatrix.needsUpdate = true;
    for (const m of movers) {
      m.position.z += speed * dt;
      if (m.position.z > 30) m.position.z -= ROAD_LEN;
    }

    // La voiture « prend sa leçon » : légers changements de voie
    const weave = Math.sin(t * 0.35) * 0.9 + Math.sin(t * 0.13) * 0.6;
    car.group.position.x = LANE / 2 + weave * 0.6;
    car.group.rotation.y = -Math.cos(t * 0.35) * 0.05;
    car.body.position.y = 0.02 * Math.sin(t * 9);
    car.wheels.forEach((w) => (w.rotation.x -= speed * dt * 2.6));

    // Caméra : poursuite + parallaxe souris + plongée au défilement
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    const s = Math.min(scroll, 1);
    const narrow = camera.aspect < 1;
    camera.position.set(
      car.group.position.x - (narrow ? 1.5 : 5.5) + pointer.x * 2.5 - s * 2,
      3 + pointer.y * 0.8 + s * 5,
      (narrow ? 12 : 10.5) - s * 2,
    );
    camera.lookAt(car.group.position.x - (narrow ? 0.5 : 2.2), 1 - s * 0.6, -8);

    renderer.render(scene, camera);
    if (running && !reducedMotion) raf = requestAnimationFrame(frame);
  }

  const onPointer = (e) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = -((e.clientY / window.innerHeight) * 2 - 1);
  };
  const onScroll = () => {
    const r = canvas.getBoundingClientRect();
    scroll = Math.max(0, -r.top / r.height);
    speed = 16 + scroll * 30;
  };

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });

  // Pause hors écran / onglet masqué
  const io = new IntersectionObserver(([entry]) => {
    const visible = entry.isIntersecting && !document.hidden;
    if (visible && !running) { running = true; clock.update(); frame(); }
    if (!visible) { running = false; cancelAnimationFrame(raf); }
  });
  io.observe(canvas);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { running = false; cancelAnimationFrame(raf); }
    else if (!running) { running = true; clock.update(); frame(); }
  });

  resize();
  if (reducedMotion) { distance = 40; frame(); } else frame();
}

// --- Fabrication des objets ------------------------------------------------

function makeCar() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const red = new THREE.MeshPhysicalMaterial({ color: 0xd8091a, metalness: 0.55, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.15 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0c0d10, metalness: 0.4, roughness: 0.35 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0b1020, metalness: 0.9, roughness: 0.05 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const rim = new THREE.MeshStandardMaterial({ color: 0xc9ccd3, metalness: 0.9, roughness: 0.25 });

  // Carrosserie (citadine 5 portes, toit noir comme la voiture de l'école)
  const lower = new THREE.Mesh(roundedBox(1.8, 0.62, 4.0, 0.18), red);
  lower.position.y = 0.62;
  body.add(lower);
  const nose = new THREE.Mesh(roundedBox(1.74, 0.3, 1.0, 0.14), red);
  nose.position.set(0, 0.98, -1.35); nose.rotation.x = 0.12;
  body.add(nose);
  const cabin = new THREE.Mesh(roundedBox(1.62, 0.6, 2.25, 0.2), glass);
  cabin.position.set(0, 1.18, 0.3);
  body.add(cabin);
  const roof = new THREE.Mesh(roundedBox(1.58, 0.1, 1.9, 0.05), black);
  roof.position.set(0, 1.5, 0.35);
  body.add(roof);

  // Enseigne de toit « AUTO-ÉCOLE »
  const roofSignTex = new THREE.CanvasTexture(roofSignCanvas());
  roofSignTex.colorSpace = THREE.SRGBColorSpace;
  const roofSign = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.26, 0.32),
    [red, red, red, red, new THREE.MeshStandardMaterial({ map: roofSignTex, emissive: 0xffffff, emissiveMap: roofSignTex, emissiveIntensity: 0.35 }), new THREE.MeshStandardMaterial({ map: roofSignTex, emissive: 0xffffff, emissiveMap: roofSignTex, emissiveIntensity: 0.35 })],
  );
  roofSign.position.set(0, 1.68, 0.3);
  body.add(roofSign);

  // Feux
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6e0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff1a2a });
  for (const x of [-0.62, 0.62]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.05), headMat);
    h.position.set(x, 0.86, -2.01); body.add(h);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.05), tailMat);
    tl.position.set(x, 0.92, 2.01); body.add(tl);
  }
  const tailGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff2030, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  tailGlow.scale.set(3.2, 1.2, 1); tailGlow.position.set(0, 0.92, 2.15); body.add(tailGlow);

  // Calandre
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.26, 0.05), black);
  grille.position.set(0, 0.55, -2.01); body.add(grille);

  // Roues
  const wheels = [];
  for (const [x, z] of [[-0.86, -1.3], [0.86, -1.3], [-0.86, 1.3], [0.86, 1.3]]) {
    const w = new THREE.Group();
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 24), tyre);
    t.rotation.z = Math.PI / 2; w.add(t);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.27, 10), rim);
    r.rotation.z = Math.PI / 2; w.add(r);
    w.position.set(x, 0.36, z);
    group.add(w); wheels.push(w);
  }

  // Ombre douce sous la voiture
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 5),
    new THREE.MeshBasicMaterial({ map: glowTexture("#000"), transparent: true, opacity: 0.8, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.015;
  group.add(shadow);

  group.position.set(LANE / 2, 0, 0);
  return { group, body, wheels };
}

function makeSign(type, size) {
  const g = new THREE.Group();
  const front = new THREE.CanvasTexture(signCanvas(type, 256));
  front.colorSpace = THREE.SRGBColorSpace;
  const back = new THREE.CanvasTexture(signBackCanvas(type, 128));
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({ map: front, transparent: true, alphaTest: 0.5, emissive: 0xffffff, emissiveMap: front, emissiveIntensity: 0.25, side: THREE.FrontSide }),
  );
  const rear = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: back, transparent: true, alphaTest: 0.5 }));
  rear.rotation.y = Math.PI; rear.position.z = -0.02;
  const h = 2.2 + size / 2;
  face.position.y = rear.position.y = h;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, h, 6), new THREE.MeshStandardMaterial({ color: 0x9aa0aa, metalness: 0.7, roughness: 0.4 }));
  pole.position.set(0, h / 2, -0.05);
  g.add(face, rear, pole);
  return g;
}

function roundedBox(w, h, d, r) {
  // Boîte aux arêtes adoucies : extrusion d'un rectangle arrondi
  const shape = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r); shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d - r * 2, bevelEnabled: true, bevelSize: r * 0.6, bevelThickness: r, bevelSegments: 3, curveSegments: 6 });
  geo.center();
  return geo;
}

function roofSignCanvas() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 140;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#e30613"; ctx.fillRect(0, 0, 512, 140);
  ctx.fillStyle = "#fff"; ctx.font = '800 92px "Barlow Condensed", Arial Narrow, sans-serif';
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("AUTO-ÉCOLE", 256, 76);
  return c;
}

function glowTexture(color = "#fff") {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, color); g.addColorStop(1, "rgba(0,0,0,0)");
  if (color === "#fff") { g.addColorStop(0.25, "rgba(255,255,255,0.45)"); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function windowsTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 64, 64);
  for (let y = 4; y < 64; y += 12)
    for (let x = 4; x < 64; x += 10)
      if (Math.random() < 0.35) { ctx.fillStyle = Math.random() < 0.8 ? "#ffcf7a" : "#9fc2ff"; ctx.fillRect(x, y, 5, 6); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function skyTexture() {
  const c = document.createElement("canvas");
  c.width = 4; c.height = 512;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#07080d"); g.addColorStop(0.55, "#1b1f33"); g.addColorStop(0.8, "#3a2333"); g.addColorStop(1, "#1a1d2b");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
