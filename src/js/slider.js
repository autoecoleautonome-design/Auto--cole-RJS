// Slider accessible : glisser (souris/tactile), flèches, clavier, lecture auto.
// Usage : <div class="slider" data-slider data-autoplay="6000">
//           <div class="slider__viewport"><div class="slider__track">…</div></div>
//         </div>

export class Slider {
  constructor(root) {
    this.root = root;
    this.viewport = root.querySelector(".slider__viewport");
    this.track = root.querySelector(".slider__track");
    this.slides = [...this.track.children];
    this.index = 0;
    this.offset = 0;
    this.autoplay = Number(root.dataset.autoplay || 0);
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    root.setAttribute("role", "region");
    root.setAttribute("aria-roledescription", "carrousel");
    this.viewport.tabIndex = 0;
    this.slides.forEach((s, i) => {
      s.setAttribute("role", "group");
      s.setAttribute("aria-roledescription", "diapositive");
      s.setAttribute("aria-label", `${i + 1} sur ${this.slides.length}`);
    });

    this.buildControls();
    this.bindDrag();
    this.viewport.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); this.go(this.index + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); this.go(this.index - 1); }
    });
    new ResizeObserver(() => this.go(this.index, false)).observe(this.viewport);
    this.go(0, false);
    if (this.autoplay && !this.reduced) this.startAutoplay();
  }

  buildControls() {
    const c = document.createElement("div");
    c.className = "slider__controls";
    c.innerHTML = `
      <button class="slider__btn" type="button" data-prev aria-label="Précédent">‹</button>
      <div class="slider__progress" aria-hidden="true"><span></span></div>
      <span class="slider__count" aria-live="polite"></span>
      <button class="slider__btn" type="button" data-next aria-label="Suivant">›</button>`;
    this.root.append(c);
    this.prevBtn = c.querySelector("[data-prev]");
    this.nextBtn = c.querySelector("[data-next]");
    this.bar = c.querySelector(".slider__progress");
    this.count = c.querySelector(".slider__count");
    this.prevBtn.addEventListener("click", () => { this.stopAutoplay(); this.go(this.index - 1); });
    this.nextBtn.addEventListener("click", () => { this.stopAutoplay(); this.go(this.index + 1); });
  }

  get maxOffset() {
    return Math.max(0, this.track.scrollWidth - this.viewport.clientWidth);
  }

  /** Dernier index utile : au-delà, la piste est déjà au bout. */
  get lastIndex() {
    const max = this.maxOffset;
    const i = this.slides.findIndex((s) => s.offsetLeft >= max - 1);
    return i === -1 ? this.slides.length - 1 : i;
  }

  go(i, animate = true) {
    const last = this.lastIndex;
    this.index = Math.max(0, Math.min(i, last));
    this.offset = Math.min(this.slides[this.index].offsetLeft, this.maxOffset);
    this.track.style.transition = animate && !this.reduced ? "transform .55s cubic-bezier(.2,.8,.2,1)" : "none";
    this.track.style.transform = `translate3d(${-this.offset}px,0,0)`;
    this.prevBtn.disabled = this.index === 0;
    this.nextBtn.disabled = this.index >= last;
    this.bar.style.setProperty("--progress", `${((this.index + 1) / (last + 1)) * 100}%`);
    this.count.textContent = `${this.index + 1}/${last + 1}`;
  }

  bindDrag() {
    let startX = 0, startY = 0, base = 0, dx = 0, dragging = false, locked = null;
    const down = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      dragging = true; locked = null; dx = 0;
      startX = e.clientX; startY = e.clientY; base = this.offset;
      this.track.style.transition = "none";
      this.stopAutoplay();
    };
    const move = (e) => {
      if (!dragging) return;
      const mx = e.clientX - startX, my = e.clientY - startY;
      if (locked === null && (Math.abs(mx) > 6 || Math.abs(my) > 6)) {
        locked = Math.abs(mx) > Math.abs(my) ? "x" : "y";
        if (locked === "x") { this.viewport.setPointerCapture?.(e.pointerId); this.viewport.classList.add("is-dragging"); }
      }
      if (locked !== "x") return;
      dx = mx;
      const pos = Math.max(-80, Math.min(this.maxOffset + 80, base - dx));
      this.track.style.transform = `translate3d(${-pos}px,0,0)`;
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      this.viewport.classList.remove("is-dragging");
      if (locked === "x") {
        const target = base - dx;
        let best = 0, bestD = Infinity;
        this.slides.forEach((s, k) => { const d = Math.abs(s.offsetLeft - target); if (d < bestD) { bestD = d; best = k; } });
        if (best === this.index && Math.abs(dx) > 40) best += dx < 0 ? 1 : -1;
        this.go(best);
      }
    };
    this.viewport.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    // Un glisser ne doit pas déclencher le clic d'un lien
    this.viewport.addEventListener("click", (e) => { if (Math.abs(dx) > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
  }

  startAutoplay() {
    this.stopAutoplay();
    this.timer = setInterval(() => {
      if (document.hidden || this.root.matches(":hover, :focus-within")) return;
      this.go(this.index >= this.lastIndex ? 0 : this.index + 1);
    }, this.autoplay);
  }

  stopAutoplay() { clearInterval(this.timer); }
}

export function initSliders(scope = document) {
  return [...scope.querySelectorAll("[data-slider]")].map((el) => new Slider(el));
}
