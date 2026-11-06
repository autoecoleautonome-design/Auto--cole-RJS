// « Code du jour » : un panneau en 3D qui pivote, et une question de code.
import quiz from "../../content/quiz.json";

export async function initQuiz(root) {
  const signBox = root.querySelector("[data-quiz-sign]");
  const qEl = root.querySelector("[data-quiz-question]");
  const answersEl = root.querySelector("[data-quiz-answers]");
  const feedback = root.querySelector("[data-quiz-feedback]");
  const nextBtn = root.querySelector("[data-quiz-next]");
  const scoreEl = root.querySelector("[data-quiz-score]");

  // La question du jour change chaque jour, puis on peut enchaîner.
  const day = Math.floor(Date.now() / 86400000);
  let index = day % quiz.length;
  let score = 0, played = 0;

  const sign = await createSign3D(signBox).catch(() => null);

  function render() {
    const q = quiz[index];
    qEl.textContent = q.question;
    feedback.textContent = "";
    nextBtn.hidden = true;
    answersEl.innerHTML = "";
    q.reponses.forEach((r, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = r;
      b.addEventListener("click", () => answer(i));
      answersEl.append(b);
    });
    sign?.show(q.panneau);
  }

  function answer(i) {
    const q = quiz[index];
    const buttons = [...answersEl.children];
    buttons.forEach((b, k) => {
      b.disabled = true;
      if (k === q.bonne) b.classList.add("is-right");
      else if (k === i) b.classList.add("is-wrong");
    });
    played++;
    if (i === q.bonne) score++;
    feedback.textContent = (i === q.bonne ? "Bonne réponse. " : "Pas tout à fait. ") + q.explication;
    scoreEl.textContent = `${score}/${played}`;
    nextBtn.hidden = false;
    nextBtn.focus({ preventScroll: true });
    sign?.spin();
  }

  nextBtn.addEventListener("click", () => { index = (index + 1) % quiz.length; render(); });
  render();
}

async function createSign3D(container) {
  const THREE = await import("three");
  const { signCanvas, signBackCanvas } = await import("./signs.js");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.set(0, 0.2, 6.2);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 4, 5);
  scene.add(key);

  const group = new THREE.Group();
  scene.add(group);
  const frontMat = new THREE.MeshStandardMaterial({ transparent: true, alphaTest: 0.5, roughness: 0.35, metalness: 0.1 });
  const backMat = new THREE.MeshStandardMaterial({ transparent: true, alphaTest: 0.5, roughness: 0.6, metalness: 0.6 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), frontMat);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), backMat);
  back.rotation.y = Math.PI;
  back.position.z = -0.04;
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 4, 12),
    new THREE.MeshStandardMaterial({ color: 0xaeb3bd, metalness: 0.8, roughness: 0.3 }),
  );
  pole.position.set(0, -2.2, -0.1);
  group.add(face, back, pole);
  group.position.y = 0.5;

  const textures = new Map();
  function tex(type) {
    if (!textures.has(type)) {
      const f = new THREE.CanvasTexture(signCanvas(type, 512));
      f.colorSpace = THREE.SRGBColorSpace;
      f.anisotropy = 4;
      const b = new THREE.CanvasTexture(signBackCanvas(type, 256));
      textures.set(type, [f, b]);
    }
    return textures.get(type);
  }

  let target = 0, current = 0, pendingType = null, drag = null, swayT = 0;
  const resize = () => {
    const s = container.clientWidth;
    renderer.setSize(s, s, false);
    camera.aspect = 1;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(container);
  resize();

  // Faire pivoter le panneau à la main
  container.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, start: target }; container.setPointerCapture(e.pointerId); });
  container.addEventListener("pointermove", (e) => { if (drag) target = drag.start + (e.clientX - drag.x) * 0.012; });
  container.addEventListener("pointerup", () => { drag = null; target = Math.round(target / (Math.PI * 2)) * Math.PI * 2; });

  function apply(type) {
    const [f, b] = tex(type);
    frontMat.map = f; backMat.map = b;
    frontMat.needsUpdate = backMat.needsUpdate = true;
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    swayT += dt;
    current += (target - current) * (reduced ? 1 : Math.min(1, dt * 6));
    // Le panneau change de face quand il est de profil (mi-rotation)
    if (pendingType && Math.abs(Math.sin(current)) > 0.95) { apply(pendingType); pendingType = null; }
    group.rotation.y = current + (reduced ? 0 : Math.sin(swayT * 0.8) * 0.12);
    group.rotation.x = reduced ? 0 : Math.sin(swayT * 0.6) * 0.04;
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  return {
    show(type) {
      if (!frontMat.map) { apply(type); return; }
      pendingType = type;
      target += Math.PI * 2;
      if (reduced) { apply(type); pendingType = null; }
    },
    spin() { target += Math.PI * 2; },
  };
}
