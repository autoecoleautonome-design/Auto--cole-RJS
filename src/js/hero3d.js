// Scène 3D de l'accueil, façon page produit : la berline tourne sur un plateau de studio ;
// le défilement de la page pilote la rotation et la caméra. Le modèle est dans car.js.
import * as THREE from "three";
import { makeCar } from "./car.js";

export function initHero3D(canvas, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studio(), 0.02).texture;
  scene.environmentIntensity = 1;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);

  // Éclairage de studio : une grande douche de lumière et deux contre-jours
  const key = new THREE.SpotLight(0xffffff, 260, 34, 0.6, 0.85, 1.6);
  key.position.set(1.5, 10, 4);
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xdfe8ff, 0.5);
  rim.position.set(6, 3, -6);
  scene.add(rim);

  // Voiture + son reflet (copie retournée sous un sol semi-transparent)
  const rig = new THREE.Group();
  const car = makeCar();
  const reflection = car.group.clone();
  reflection.scale.y = -1;
  rig.add(car.group, reflection);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.3, 6.9),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  rig.add(shadow);
  scene.add(rig);
  const spins = [];
  rig.traverse((o) => { if (o.name === "spin") spins.push(o); });

  // Plateau laqué qui se fond dans le noir
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(16, 96),
    new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.6, metalness: 0.2, transparent: true, opacity: 0.9, alphaMap: radialTexture(), depthWrite: false }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.renderOrder = 1;
  shadow.renderOrder = 2;
  scene.add(floor);

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

    // Départ en vue trois-quarts avant, puis un tour presque complet
    rig.rotation.y = -1.95 + p * Math.PI * 1.7 + (reducedMotion ? 0 : Math.sin(t * 0.4) * 0.035);
    for (const s of spins) s.rotation.x = -p * 14 * s.parent.userData.dir;

    const narrow = camera.aspect < 0.9;
    const radius = lerp(narrow ? 20 : 13.8, narrow ? 12.5 : 8.8, p);
    const elev = lerp(0.17, 0.075, p);
    const az = 0.55;
    camera.position.set(Math.sin(az) * radius * Math.cos(elev), radius * Math.sin(elev) + 0.55, Math.cos(az) * radius * Math.cos(elev));
    // La voiture remonte vite dans le cadre pour laisser la place aux messages du bas
    camera.lookAt(0, lerp(narrow ? 3.7 : 2.3, narrow ? 1.5 : 0.35, Math.min(1, p * 4)), 0);

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

/**
 * Studio photo virtuel : une pièce sombre et des boîtes à lumière. C'est ce que la
 * carrosserie reflète ; les longs reflets glissent sur la peinture quand la voiture tourne.
 */
function studio() {
  const env = new THREE.Scene();
  const light = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), side: THREE.DoubleSide });
  env.add(new THREE.Mesh(new THREE.BoxGeometry(60, 30, 60), new THREE.MeshBasicMaterial({ color: 0x0b0b0d, side: THREE.BackSide })));
  const box = (w, h, mat, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(...pos);
    m.lookAt(0, 0.8, 0);
    env.add(m);
  };
  box(2, 16, light(6, 6, 6), [0, 9, 0]); // grande boîte au plafond
  box(1, 16, light(5, 5, 5.3), [-6, 8, 0]); // deux bandes fines de part et d'autre
  box(1, 16, light(5, 5, 5.3), [6, 8, 0]);
  box(14, 4, light(6, 5.6, 5.2), [-13, 3, 2]); // panneaux latéraux
  box(14, 4, light(5.2, 5.6, 6), [13, 3, -2]);
  box(20, 6, light(4.2, 4.2, 4.2), [7.5, 4, 12]); // derrière la caméra
  box(10, 2.5, light(3, 3, 3), [-4, 2.5, -14]); // contre-jour
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: 0x151517 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  env.add(ground);
  return env;
}

/** Ombre de contact douce, à la forme de la voiture. */
function shadowTexture() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 512;
  const ctx = c.getContext("2d");
  // Le rectangle est dessiné hors champ : seule son ombre floue est visible
  ctx.shadowColor = "rgba(0,0,0,0.95)";
  ctx.shadowBlur = 34;
  ctx.shadowOffsetX = 600;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.roundRect(-600 + 52, 60, 152, 392, 46);
  ctx.fill();
  ctx.fill();
  return new THREE.CanvasTexture(c);
}

function radialTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, "#fff"); g.addColorStop(0.5, "#999"); g.addColorStop(1, "#000");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
