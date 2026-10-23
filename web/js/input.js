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
let dragSlider = null;

function clearKeys() {
  for (const k in keys) {
    keys[k] = false;
  }

  pointer = null;
  dragSlider = null;
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
        if (pauseSettingsOpen) {
          pauseSettingsOpen = false;
        } else {
          resumeGame();
        }
      }
    }

    if (mode === "menu" && k === "1") {
      startGame(1);
    }

    if (mode === "menu" && k === "2") {
      startGame(2);
    }

    if (mode === "menu" && k === "3") {
      startGame(3);
    }

    if (mode === "menu" && k === "4") {
      startGame(4);
    }

    if (mode === "menu" && k === "escape" && menuSettingsOpen) {
      menuSettingsOpen = false;
    }

    if (mode === "menu" && k === "escape" && menuCustomizeOpen) {
      menuCustomizeOpen = false;
    }

    if (mode === "over" && (k === "r" || k === "enter")) {
      toMainMenu();
    }

    if (mode === "paused" && k === "enter" && !pauseSettingsOpen) {
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

// Shared handling for the settings screen (main menu and pause menu).
// Returns "back" when the back button was pressed, "slider" while dragging.
function settingsPointerDown(p) {
  if (sliderHit(p, SETTINGS_SLIDERS.musicVol)) {
    dragSlider = "musicVol";
    settings.musicVol = sliderValue(p, SETTINGS_SLIDERS.musicVol);
    applyVolume();
    saveSettings();
    return "slider";
  }

  if (sliderHit(p, SETTINGS_SLIDERS.sfxVol)) {
    dragSlider = "sfxVol";
    settings.sfxVol = sliderValue(p, SETTINGS_SLIDERS.sfxVol);
    applyVolume();
    saveSettings();
    return "slider";
  }

  if (inRect(p, SETTINGS_BACK_BTN)) {
    return "back";
  }

  return null;
}

// Shared handling for the customization screen. Returns true when the
// back button was pressed, false otherwise.
function customizePointerDown(p) {
  for (const key of ["hue", "sat", "light"]) {
    if (sliderHit(p, CUSTOMIZE_SLIDERS[key])) {
      dragSlider = key;
      shipStyle[key] = sliderValue(p, CUSTOMIZE_SLIDERS[key]);
      saveShipStyle();
      return false;
    }
  }

  for (let i = 0; i < CUSTOMIZE_SKINS.length; i++) {
    if (inRect(p, CUSTOMIZE_SKINS[i])) {
      shipStyle.skin = i;
      saveShipStyle();
      return false;
    }
  }

  return inRect(p, CUSTOMIZE_BACK_BTN);
}

canvas.addEventListener("pointerdown", e => {
  e.preventDefault();

  const p = point(e);

  if (mode === "menu") {
    if (menuSettingsOpen) {
      if (settingsPointerDown(p) === "back") {
        menuSettingsOpen = false;
      }

      return;
    }

    if (menuCustomizeOpen) {
      if (customizePointerDown(p)) {
        menuCustomizeOpen = false;
      }

      return;
    }

    const L = MENU_LAYOUT;

    // Quit button (Android app only).
    if (IS_NATIVE_APP && inRect(p, L.quit)) {
      quitApp();
      return;
    }

    // Links to the repository and the release downloads.
    if (inCircle(p, L.github)) {
      openExternal(REPO_URL);
      return;
    }

    if (inRect(p, L.getApp)) {
      openExternal(RELEASES_URL);
      return;
    }

    // Auto-shoot button
    if (inRect(p, L.auto)) {
      autoShoot = !autoShoot;
      return;
    }

    // Settings button
    if (inRect(p, L.settings)) {
      menuSettingsOpen = true;
      return;
    }

    // Customization screen (ship skin and colors).
    if (inRect(p, L.customize)) {
      menuCustomizeOpen = true;
      return;
    }

    // Difficulty selection (EASY / NORMAL / HARD / INSANE).
    for (let i = 0; i < DIFFICULTY_LAYOUT.length; i++) {
      if (inRect(p, DIFFICULTY_LAYOUT[i])) {
        startGame(DIFFICULTIES[i].id);
        return;
      }
    }

    return;
  }

  if (mode === "over") {
    toMainMenu();
    return;
  }

  if (mode === "paused") {
    if (pauseSettingsOpen) {
      if (settingsPointerDown(p) === "back") {
        pauseSettingsOpen = false;
      }

      return;
    }

    if (inRect(p, PAUSE_RESUME_BTN)) {
      resumeGame();
    } else if (inRect(p, PAUSE_SETTINGS_BTN)) {
      pauseSettingsOpen = true;
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
  if (dragSlider) {
    const p = point(e);

    if (Object.prototype.hasOwnProperty.call(CUSTOMIZE_SLIDERS, dragSlider)) {
      shipStyle[dragSlider] = sliderValue(p, CUSTOMIZE_SLIDERS[dragSlider]);
      saveShipStyle();
      return;
    }

    settings[dragSlider] = sliderValue(p, SETTINGS_SLIDERS[dragSlider]);
    applyVolume();
    saveSettings();
    return;
  }

  if (!pointer || mode !== "playing") return;

  const p = point(e);

  ship.x += p.x - pointer.x;
  ship.y += p.y - pointer.y;

  pointer = p;
  clampShip();
});

canvas.addEventListener("pointerup", () => {
  pointer = null;
  dragSlider = null;
});

canvas.addEventListener("pointercancel", () => {
  pointer = null;
  dragSlider = null;
});
