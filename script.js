/* =========================================================
   MAXED OUT. — Interaktions-Engine
   Regel: alles Anfassbare läuft über Springs (Motion),
   nie über CSS-transition/@keyframes. Animiert wird
   ausschließlich transform + opacity.
   ========================================================= */

import { animate, inView } from "https://cdn.jsdelivr.net/npm/motion@11.11.13/+esm";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/* ---- Spring-Presets (aus der Skill-Referenztabelle) ----
   UI-Default:   damping 1.0 -> bounce 0,    response 0.35
   Momentum:     damping ~0.8 -> bounce 0.2, response 0.35
   Drawer/Sheet: damping 0.8 -> bounce 0.2,  response 0.3   */
const SPRING_UI = { type: "spring", bounce: 0, duration: 0.35 };
const SPRING_MOMENTUM = { type: "spring", bounce: 0.2, duration: 0.35 };
const SPRING_DRAWER = { type: "spring", bounce: 0.2, duration: 0.3 };
const INSTANT = { duration: reducedMotion.matches ? 0.12 : 0.2, easing: "ease-out" };

function springFor(preset) {
  return reducedMotion.matches ? INSTANT : preset;
}

/* =========================================================
   1) Press-Feedback — auf pointerdown, nicht auf Loslassen
   ========================================================= */

function wirePressFeedback(selector, downScale = 0.96) {
  document.querySelectorAll(selector).forEach((el) => {
    let pressed = false;

    el.addEventListener("pointerdown", () => {
      pressed = true;
      animate(el, { scale: downScale }, springFor(SPRING_UI));
    });

    const release = () => {
      if (!pressed) return;
      pressed = false;
      animate(el, { scale: 1 }, springFor(SPRING_MOMENTUM));
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

/* Scroll-Cue: sanftes, endloses Schweben nach unten und
   zurück — reine Deko, kein Nutzer-Input, daher kein Spring
   nötig, sondern ein ruhiger Ease-Loop. Respektiert
   reduced-motion (bleibt dann einfach still stehen). */
const scrollCue = document.querySelector(".scroll-cue");
if (scrollCue && !reducedMotion.matches) {
  animate(scrollCue, { y: [0, 10, 0] }, { duration: 1.8, repeat: Infinity, easing: "ease-in-out" });
}

/* =========================================================
   Cursor-Licht auf Buttons — die Position folgt der Maus
   1:1 (kein Lag, das soll sich wie echtes Licht anfühlen),
   nur das Auf-/Abblenden beim Rein-/Rausfahren ist gefedert.
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
      animate(current, 0.4, {
        ...SPRING_UI,
        onUpdate: (v) => {
          current = v;
          el.style.setProperty("--glow-a", v);
        },
      });
    });

    el.addEventListener("pointerleave", (e) => {
      if (e.pointerType !== "mouse") return;
      animate(current, 0, {
        ...SPRING_MOMENTUM,
        onUpdate: (v) => {
          current = v;
          el.style.setProperty("--glow-a", v);
        },
      });
    });
  });
}

wireCursorGlow(".btn, .social-link, .scroll-cue");

/* Karten: sanftes Anheben bei Hover (nur Pointer-Geräte,
   spring-basiert, kein CSS-transition) */
document.querySelectorAll(".card").forEach((el) => {
  el.addEventListener("pointerenter", (e) => {
    if (e.pointerType !== "mouse") return;
    animate(el, { y: "-0.35rem" }, springFor(SPRING_UI));
  });
  el.addEventListener("pointerleave", (e) => {
    if (e.pointerType !== "mouse") return;
    animate(el, { y: "0rem" }, springFor(SPRING_UI));
  });
});

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
  animate(scrim, { opacity: [0, 1] }, springFor(SPRING_UI));
  animate(panel, { x: ["100%", "0%"] }, springFor(SPRING_DRAWER));
  burger.setAttribute("aria-expanded", "true");
}

function closeDrawer() {
  if (!drawer) return;
  document.body.style.overflow = "";
  animate(scrim, { opacity: [1, 0] }, springFor(SPRING_UI));
  // exakt derselbe Weg zurück, den es hereinkam
  animate(panel, { x: ["0%", "100%"] }, springFor(SPRING_DRAWER))
    .finished.then(() => { drawer.dataset.open = "false"; });
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
   3) Scroll-Reveal — Section-Inhalte tauchen aus dem
   Präsentationswert auf (opacity + kleiner Y-Offset)
   ========================================================= */

document.querySelectorAll("[data-reveal]").forEach((el) => {
  // Erst JETZT, da wir wissen dass JS läuft, unsichtbar machen —
  // Standardzustand im HTML/CSS ist immer sichtbar.
  el.style.opacity = "0";
  el.style.transform = "translateY(1.25rem)";

  inView(
    el,
    () => {
      animate(
        el,
        { opacity: [0, 1], y: ["1.25rem", "0rem"] },
        springFor(SPRING_UI)
      );
    },
    { amount: 0.3 }
  );
});

/* =========================================================
   4) Anchor-Scroll mit eigenem Tempo. CSS allein
   (scroll-behavior: smooth) lässt sich in der Geschwindigkeit
   nicht steuern — dafür hier ein sanft ein-/ausschwingender
   Scroll mit fester, bewusst ruhiger Dauer. CSS bleibt als
   Fallback aktiv, falls dieses Skript nicht laden sollte.
   ========================================================= */

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function animateScrollTo(targetY, duration) {
  const startY = window.scrollY;
  const diff = targetY - startY;
  const startTime = performance.now();

  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    window.scrollTo(0, startY + diff * easeInOutCubic(progress));
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
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
      animateScrollTo(targetY, 1400); // ruhiges Tempo, kein hartes Springen
    }
  });
});
