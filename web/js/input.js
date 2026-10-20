"use strict";

// --------------------------------------------------
// DEVICE DETECTION AND CONTROLS
// --------------------------------------------------

const isMobile =
  window.matchMedia("(pointer: coarse)").matches ||
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

document.querySelector("#help").textContent = isMobile
  ? "Touch: Move ship · Auto-Shoot toggle in menu · Esc: Pause"
  : "WASD / Arrow keys: Move · Space: Shoot · P: Music · Esc: Pause";

// Enabled by default on mobile devices.
// Disabled by default on desktop.
let autoShoot = isMobile;

const keys = {};
let pointer = null;

function clearKeys() {
  for (const k in keys) {
    keys[k] = false;
  }

  pointer = null;
}

// --------------------------------------------------
// KEYBOARD
// --------------------------------------------------

window.addEventListener("keydown", e => {
  const k = e.key.toLowerCase();

  if (
    [" ", "arrowup", "arrowdown", "arrowleft", "arrowright"]
      .includes(k)
  ) {
    e.preventDefault();
  }

  if (!keys[k]) {
    if (k === "p") {
      toggleMusic();
    }

    if (k === "escape") {
      if (mode === "playing") {
        pauseGame();
      } else if (mode === "paused") {
        resumeGame();
      }
    }

    if (mode === "menu" && k === "1") {
      startGame(1);
    }

    if (mode === "menu" && k === "2") {
      startGame(2);
    }

    if (mode === "over" && (k === "r" || k === "enter")) {
      toMainMenu();
    }

    if (mode === "paused" && k === "enter") {
      resumeGame();
    }

    // Auto-shoot can also be toggled with O.
    if (k === "o") {
      autoShoot = !autoShoot;
    }
  }

  keys[k] = true;
});

window.addEventListener("keyup", e => {
  keys[e.key.toLowerCase()] = false;
});

window.addEventListener("blur", () => {
  clearKeys();

  if (mode === "playing") {
    pauseGame();
  }
});

// --------------------------------------------------
// MOUSE AND TOUCH
// --------------------------------------------------

function point(e) {
  const r = canvas.getBoundingClientRect();

  return {
    x: (e.clientX - r.left) * W / r.width,
    y: (e.clientY - r.top) * H / r.height
  };
}

canvas.addEventListener("pointerdown", e => {
  e.preventDefault();

  const p = point(e);

  if (mode === "menu") {
    // Auto-shoot button
    if (
      p.x >= 150 && p.x <= 450 &&
      p.y >= 470 && p.y <= 540
    ) {
      autoShoot = !autoShoot;
      return;
    }

    // Difficulty selection
    if (p.y >= 270 && p.y < 350) {
      startGame(1);
      return;
    }

    if (p.y >= 350 && p.y < 430) {
      startGame(2);
      return;
    }

    return;
  }

  if (mode === "over") {
    toMainMenu();
    return;
  }

  if (mode === "paused") {
    if (inRect(p, PAUSE_RESUME_BTN)) {
      resumeGame();
    } else if (inRect(p, PAUSE_MENU_BTN)) {
      toMainMenu();
    }

    return;
  }

  // Pause button, top left corner during a round.
  if (inRect(p, PAUSE_BTN)) {
    pauseGame();
    return;
  }

  pointer = p;

  try {
    canvas.setPointerCapture(e.pointerId);
  } catch (_) {}
});

canvas.addEventListener("pointermove", e => {
  if (!pointer || mode !== "playing") return;

  const p = point(e);

  ship.x += p.x - pointer.x;
  ship.y += p.y - pointer.y;

  pointer = p;
  clampShip();
});

canvas.addEventListener("pointerup", () => {
  pointer = null;
});

canvas.addEventListener("pointercancel", () => {
  pointer = null;
});
