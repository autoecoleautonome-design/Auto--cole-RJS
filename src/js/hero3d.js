// Scène 3D de l'accueil, façon page produit : la voiture-école tourne sur un plateau
// de studio ; le défilement de la page pilote la rotation et la caméra.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export function initHero3D(canvas, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);

  // Éclairage de studio : une douche de lumière + deux contre-jours colorés
  const key = new THREE.SpotLight(0xffffff, 260, 30, 0.55, 0.7, 1.6);
  key.position.set(0, 9, 3);
  key.target.position.set(0, 0, 0);
  scene.add(key, key.target);
  const rimRed = new THREE.PointLight(0xff2d3a, 60, 16, 1.6);
  rimRed.position.set(-5, 2.2, -4);
  const rimBlue = new THREE.PointLight(0x4c6ef5, 45, 16, 1.6);
  rimBlue.position.set(5, 2, -3.5);
  scene.add(rimRed, rimBlue);

  // Plateau brillant qui se fond dans le noir
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(14, 96),
    new THREE.MeshStandardMaterial({ color: 0x0d0d10, roughness: 0.28, metalness: 0.6, transparent: true, alphaMap: radialTexture() }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3.6, 3.64, 128),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.005;
  scene.add(ring);

  const car = makeCar();
  scene.add(car.group);

  let progress = 0;
  let shown = 0;
  let running = true;
  let raf = 0;
  const clock = new THREE.Timer();
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t);

  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 700 ? 44 : 30;
    camera.updateProjectionMatrix();
  }

  function frame() {
    clock.update();
    const t = clock.getElapsed();
    // Le mouvement suit le défilement avec un léger amorti (effet « glissé »)
    shown += (progress - shown) * (reducedMotion ? 1 : 0.08);
    const p = ease(Math.min(1, Math.max(0, shown)));

    car.group.rotation.y = -0.65 + p * Math.PI * 1.65 + (reducedMotion ? 0 : Math.sin(t * 0.4) * 0.04);
    car.wheels.forEach((w) => (w.rotation.x = -p * 18));
    car.glow.material.opacity = 0.3 + 0.1 * Math.sin(t * 2);

    const narrow = camera.aspect < 0.9;
    const radius = lerp(narrow ? 21 : 15, narrow ? 13 : 8.8, p);
    const elev = lerp(0.2, 0.07, p);
    const az = 0.55;
    camera.position.set(Math.sin(az) * radius * Math.cos(elev), radius * Math.sin(elev) + 0.6, Math.cos(az) * radius * Math.cos(elev));
    camera.lookAt(0, lerp(narrow ? 4.2 : 2.7, 0.85, p), 0);

    renderer.render(scene, camera);
    if (running && !reducedMotion) raf = requestAnimationFrame(frame);
  }

  window.addEventListener("resize", () => { resize(); if (reducedMotion) frame(); });
  const io = new IntersectionObserver(([entry]) => {
    const visible = entry.isIntersecting && !document.hidden;
    if (visible && !running) { running = true; frame(); }
    if (!visible) { running = false; cancelAnimationFrame(raf); }
  });
  io.observe(canvas);

  resize();
  frame();

  return {
    setProgress(p) {
      progress = p;
      if (reducedMotion) frame();
    },
  };
}

// --- La voiture ------------------------------------------------------------

function makeCar() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const red = new THREE.MeshPhysicalMaterial({ color: 0xd8091a, metalness: 0.5, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06 });
  const black = new THREE.MeshPhysicalMaterial({ color: 0x08080a, metalness: 0.4, roughness: 0.2, clearcoat: 1 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x05070c, metalness: 0.95, roughness: 0.04 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.85 });
  const rim = new THREE.MeshStandardMaterial({ color: 0xd9dce3, metalness: 1, roughness: 0.18 });

  const lower = new THREE.Mesh(roundedBox(1.84, 0.64, 4.05, 0.2), red);
  lower.position.y = 0.66;
  body.add(lower);
  const nose = new THREE.Mesh(roundedBox(1.76, 0.3, 1.05, 0.14), red);
  nose.position.set(0, 1.02, -1.35);
  nose.rotation.x = 0.13;
  body.add(nose);
  const cabin = new THREE.Mesh(roundedBox(1.64, 0.62, 2.3, 0.24), glass);
  cabin.position.set(0, 1.24, 0.3);
  body.add(cabin);
  const roof = new THREE.Mesh(roundedBox(1.6, 0.1, 1.95, 0.05), black);
  roof.position.set(0, 1.56, 0.36);
  body.add(roof);

  // Enseigne de toit « AUTO-ÉCOLE »
  const signTex = new THREE.CanvasTexture(roofSignCanvas());
  signTex.colorSpace = THREE.SRGBColorSpace;
  const signFace = new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.55 });
  const roofSign = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.27, 0.34), [red, red, red, red, signFace, signFace]);
  roofSign.position.set(0, 1.75, 0.3);
  body.add(roofSign);

  // Feux, calandre et filet blanc
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6e8 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff1a2a });
  for (const x of [-0.63, 0.63]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.09, 0.05), headMat);
    h.position.set(x, 0.9, -2.04);
    body.add(h);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.11, 0.05), tailMat);
    tl.position.set(x, 0.96, 2.04);
    body.add(tl);
  }
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.26, 0.05), black);
  grille.position.set(0, 0.57, -2.04);
  body.add(grille);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.865, 0.035, 3.2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
  stripe.position.set(0, 0.52, 0.1);
  body.add(stripe);

  // Roues
  const wheels = [];
  for (const [x, z] of [[-0.88, -1.32], [0.88, -1.32], [-0.88, 1.32], [0.88, 1.32]]) {
    const w = new THREE.Group();
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.27, 32), tyre);
    t.rotation.z = Math.PI / 2;
    w.add(t);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.28, 10), rim);
    r.rotation.z = Math.PI / 2;
    w.add(r);
    w.position.set(x, 0.37, z);
    group.add(w);
    wheels.push(w);
  }

  // Ombre de contact + halo rouge au sol
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 5.6),
    new THREE.MeshBasicMaterial({ map: glowTexture("#000"), transparent: true, opacity: 0.95, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  group.add(shadow);
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 9),
    new THREE.MeshBasicMaterial({ map: glowTexture("#e30613"), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.008;
  group.add(glow);

  return { group, body, wheels, glow };
}

function roundedBox(w, h, d, r) {
  const shape = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r); shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d - r * 2, bevelEnabled: true, bevelSize: r * 0.6, bevelThickness: r, bevelSegments: 4, curveSegments: 8 });
  geo.center();
  return geo;
}

function roofSignCanvas() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 140;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#e30613"; ctx.fillRect(0, 0, 512, 140);
  ctx.fillStyle = "#fff"; ctx.font = '800 84px "Inter Tight", Arial, sans-serif';
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("AUTO-ÉCOLE", 256, 76);
  return c;
}

function glowTexture(color) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, color); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function radialTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, "#fff"); g.addColorStop(0.55, "#888"); g.addColorStop(1, "#000");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
