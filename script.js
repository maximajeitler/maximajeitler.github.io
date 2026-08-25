/* =========================================================
   MAXED OUT. — Interaktions-Engine (ohne externe Bibliothek)
   Regel: alles Anfassbare läuft über Springs, nie über
   CSS-transition/@keyframes. Animiert wird ausschließlich
   transform und opacity.

   Wichtig: dieses Skript hat KEINE Abhängigkeit zu einem
   fremden Server mehr (kein import von einem CDN). Alle
   Federungen sind selbst geschrieben. Dadurch kann ein
   einzelner fehlgeschlagener externer Ladevorgang nie mehr
   das ganze Skript (inkl. Scroll-Verhalten) lahmlegen.
   ========================================================= */

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/* ---------------------------------------------------------
   Federn (Spring) — echte Masse-Feder-Dämpfer-Simulation,
   pro Frame numerisch integriert. Ersetzt die drei Presets
   aus der Skill-Referenztabelle:
   UI-Default (damping 1.0)   -> stiffness 210, damping 26
   Momentum   (damping ~0.8)  -> stiffness 210, damping 20
   Drawer/Sheet (damping 0.8) -> stiffness 220, damping 24
--------------------------------------------------------- */

const SPRING_UI = { stiffness: 210, damping: 26 };
const SPRING_MOMENTUM = { stiffness: 210, damping: 20 };
const SPRING_DRAWER = { stiffness: 220, damping: 24 };

function springTo(from, to, { stiffness, damping, mass = 1, onUpdate, onComplete }) {
  if (reducedMotion.matches) {
    onUpdate(to);
    onComplete?.();
    return;
  }
  let value = from;
  let velocity = 0;
  let lastTime = performance.now();

  function step(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.064);
    lastTime = now;
    const force = -stiffness * (value - to);
    const damp = -damping * velocity;
    velocity += ((force + damp) / mass) * dt;
    value += velocity * dt;
    onUpdate(value);

    if (Math.abs(to - value) > 0.001 || Math.abs(velocity) > 0.001) {
      requestAnimationFrame(step);
    } else {
      onUpdate(to);
      onComplete?.();
    }
  }
  requestAnimationFrame(step);
}

/* =========================================================
   1) Press-Feedback — auf pointerdown, nicht beim Loslassen
   ========================================================= */

function wirePressFeedback(selector, downScale = 0.96) {
  document.querySelectorAll(selector).forEach((el) => {
    let current = 1;
    let pressed = false;

    el.addEventListener("pointerdown", () => {
      pressed = true;
      springTo(current, downScale, { ...SPRING_UI, onUpdate: (v) => { current = v; el.style.transform = `scale(${v})`; } });
    });

    const release = () => {
      if (!pressed) return;
      pressed = false;
      springTo(current, 1, { ...SPRING_MOMENTUM, onUpdate: (v) => { current = v; el.style.transform = `scale(${v})`; } });
    };

    el.addEventListener("pointerup", release);
    el.addEventListener("pointerleave", release);
    el.addEventListener("pointercancel", release);
  });
}

wirePressFeedback(".btn", 0.96);
wirePressFeedback(".card", 0.985);
wirePressFeedback(".nav__burger, .drawer__close", 0.9);
wirePressFeedback(".scroll-cue", 0.88);
wirePressFeedback(".social-link", 0.96);

/* Karten: sanftes Anheben bei Hover (nur Maus) */
document.querySelectorAll(".card").forEach((el) => {
  let current = 0;
  el.addEventListener("pointerenter", (e) => {
    if (e.pointerType !== "mouse") return;
    springTo(current, -6, { ...SPRING_UI, onUpdate: (v) => { current = v; el.style.translate = `0 ${v}px`; } });
  });
  el.addEventListener("pointerleave", (e) => {
    if (e.pointerType !== "mouse") return;
    springTo(current, 0, { ...SPRING_UI, onUpdate: (v) => { current = v; el.style.translate = `0 ${v}px`; } });
  });
});

/* Scroll-Cue: sanftes, endloses Schweben — reine Deko,
   kein Nutzer-Input, daher ein ruhiger Sinus-Loop statt Spring. */
const scrollCue = document.querySelector(".scroll-cue");
if (scrollCue && !reducedMotion.matches) {
  const start = performance.now();
  function bounce(now) {
    const t = (now - start) / 1000;
    const y = Math.sin(t * (Math.PI / 1.6)) * 6 + 6;
    scrollCue.style.translate = `0 ${y}px`;
    requestAnimationFrame(bounce);
  }
  requestAnimationFrame(bounce);
}

/* =========================================================
   Cursor-Licht auf Buttons — Position folgt der Maus 1:1
   (kein Lag), nur das Auf-/Abblenden ist gefedert.
   ========================================================= */

function wireCursorGlow(selector) {
  if (reducedMotion.matches) return;
  document.querySelectorAll(selector).forEach((el) => {
    let current = 0;

    el.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      el.style.setProperty("--mx", `${x}%`);
      el.style.setProperty("--my", `${y}%`);
    });

    el.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse") return;
      springTo(current, 0.4, { ...SPRING_UI, onUpdate: (v) => { current = v; el.style.setProperty("--glow-a", v); } });
    });

    el.addEventListener("pointerleave", (e) => {
      if (e.pointerType !== "mouse") return;
      springTo(current, 0, { ...SPRING_MOMENTUM, onUpdate: (v) => { current = v; el.style.setProperty("--glow-a", v); } });
    });
  });
}

wireCursorGlow(".btn, .social-link, .scroll-cue");

/* =========================================================
   2) Mobile Drawer — Enter-/Exit-Pfad identisch,
   transform-origin auf dem Burger-Button
   ========================================================= */

const drawer = document.querySelector("[data-drawer]");
const burger = document.querySelector(".nav__burger");
const drawerClose = document.querySelector(".drawer__close");
const scrim = document.querySelector(".drawer__scrim");
const panel = document.querySelector(".drawer__panel");

function openDrawer() {
  if (!drawer) return;
  drawer.dataset.open = "true";
  document.body.style.overflow = "hidden";
  scrim.style.opacity = "0";
  springTo(0, 1, { ...SPRING_UI, onUpdate: (v) => { scrim.style.opacity = v; } });
  springTo(100, 0, { ...SPRING_DRAWER, onUpdate: (v) => { panel.style.transform = `translateX(${v}%)`; } });
  burger.setAttribute("aria-expanded", "true");
}

function closeDrawer() {
  if (!drawer) return;
  document.body.style.overflow = "";
  springTo(1, 0, { ...SPRING_UI, onUpdate: (v) => { scrim.style.opacity = v; } });
  springTo(0, 100, {
    ...SPRING_DRAWER,
    onUpdate: (v) => { panel.style.transform = `translateX(${v}%)`; },
    onComplete: () => { drawer.dataset.open = "false"; },
  });
  burger?.setAttribute("aria-expanded", "false");
}

burger?.addEventListener("click", openDrawer);
drawerClose?.addEventListener("click", closeDrawer);
scrim?.addEventListener("click", closeDrawer);
drawer?.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeDrawer));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && drawer?.dataset.open === "true") closeDrawer();
});

/* =========================================================
   3) Scroll-Reveal — Section-Inhalte tauchen sanft auf.
   Standardzustand im HTML/CSS ist sichtbar; erst wenn wir
   wissen, dass JS läuft, blenden wir kurz aus und wieder ein.
   ========================================================= */

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      springTo(0, 1, { ...SPRING_UI, onUpdate: (v) => { el.style.opacity = v; } });
      springTo(20, 0, { ...SPRING_UI, onUpdate: (v) => { el.style.translate = `0 ${v}px`; } });
      revealObserver.unobserve(el);
    });
  },
  { threshold: 0.3 }
);

document.querySelectorAll("[data-reveal]").forEach((el) => {
  el.style.opacity = "0";
  el.style.translate = "0 20px";
  revealObserver.observe(el);
});

/* =========================================================
   4) Anchor-Scroll mit eigenem, ruhigem Tempo. CSS
   (scroll-behavior: smooth) bleibt als Fallback aktiv, falls
   dieses Skript aus irgendeinem Grund nicht laufen sollte.
   ========================================================= */

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function animateScrollTo(targetY, duration) {
  const startY = window.scrollY;
  const diff = targetY - startY;
  const startTime = performance.now();

  const html = document.documentElement;
  const previousBehavior = html.style.scrollBehavior;
  html.style.scrollBehavior = "auto";

  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    window.scrollTo(0, startY + diff * easeInOutCubic(progress));
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      html.style.scrollBehavior = previousBehavior;
    }
  }
  requestAnimationFrame(step);
}

/* =========================================================
   5) Gauge — der Zeiger im Hero zeigt den Scroll-Fortschritt
   der ganzen Seite: leer am Anfang, "maxed out" ganz unten.
   Läuft über eine kritisch gedämpfte Annäherung pro Frame
   (kein Spring-Objekt nötig, reine Werte-Interpolation) —
   dadurch jederzeit unterbrechbar, auch bei schnellem Scrollen.
   ========================================================= */

const needle = document.querySelector(".gauge__needle");

if (needle) {
  const MIN_DEG = -78;
  const MAX_DEG = 78;
  let current = MIN_DEG;
  let target = MIN_DEG;

  function updateTarget() {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - doc.clientHeight;
    const p = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
    target = MIN_DEG + p * (MAX_DEG - MIN_DEG);
  }

  function tick() {
    const ease = reducedMotion.matches ? 1 : 0.12;
    current += (target - current) * ease;
    needle.style.transform = `rotate(${current}deg)`;
    requestAnimationFrame(tick);
  }

  updateTarget();
  current = target;
  window.addEventListener("scroll", updateTarget, { passive: true });
  window.addEventListener("resize", updateTarget);
  requestAnimationFrame(tick);
}

const navEl = document.querySelector(".nav");

document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    if (id.length < 2) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();

    const navHeight = navEl?.offsetHeight || 0;
    const targetY = target.getBoundingClientRect().top + window.scrollY - navHeight - 16;

    if (reducedMotion.matches) {
      window.scrollTo(0, targetY);
    } else {
      animateScrollTo(targetY, 1400);
    }
  });
});
