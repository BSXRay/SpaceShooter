"use strict";

// --------------------------------------------------
// GAME STATE
// --------------------------------------------------

let mode = "menu"; // "menu" | "playing" | "paused" | "over"

let ship;
let bullets;
let meteors;
let aliens;
let explosions;
let pickups;

let lives = 5;
let score = 0;
let ticks = 0;
let meteorTimer = 0;

let lastTime = 0;
let accumulator = 0;

// Timestamp of the current frame in ms, used for time-based animations.
let now = 0;
let pausedAt = 0;

// Power-ups: `weight` is a relative drop chance (higher = more common).
// Rapid Fire is the most common, then Damage Boost, then Spread Shot.
// Power-up pickups & effects. `weight` is a relative drop chance
// (higher = more common). `duration` is how long one pickup lasts; a
// second copy stacks another full duration on top.
const POWERUP_DURATION = 10000; // ms

const POWERUPS = [
  {
    key: "rapidFire",
    image: "rapidFire",
    name: "RAPID FIRE",
    weight: 50,
    color: "#ffd24a",
    duration: POWERUP_DURATION
  },
  {
    key: "damageBoost",
    image: "damageBoost",
    name: "DAMAGE BOOST",
    weight: 30,
    color: "#ff6b6b",
    duration: POWERUP_DURATION
  },
  {
    key: "spreadShot",
    image: "spreadShot",
    name: "SPREAD SHOT",
    weight: 20,
    color: "#7fb2ff",
    duration: POWERUP_DURATION
  }
];

// Active power-ups, each with a remaining time in ms. Drawn bottom-left.
let ownedPowerups = [];

// Award banner animation state. Phases: "in" -> "hold" -> "out" -> null.
const AWARD = {
  IN_MS: 480,
  HOLD_MS: 750,
  OUT_MS: 460,
  BADGE_Y: 640,
  SLOT_X: 62,
  SLOT_Y: 858
};

let award = null;

// Difficulty presets. `meteorInterval` and `alienChance` are in update
// ticks; lower interval / higher chance means more enemies.
const DIFFICULTIES = [
  {
    id: 1,
    name: "EASY",
    meteorInterval: 50,
    alienChance: 1,
    alienSpeedUp: 0,
    alienHp: 1,
    meteorShootable: false,
    tightAlienHitbox: false,
    hitRadius: 0.35,
    // Power-ups are rarer on EASY and the common ones even less likely.
    // Spread Shot keeps its weight (20), so it becomes the most common here.
    dropChance: 0.18,
    powerupWeights: { rapidFire: 16, damageBoost: 12, spreadShot: 20 }
  },
  {
    id: 2,
    name: "NORMAL",
    meteorInterval: 38,
    alienChance: 1.5,
    alienSpeedUp: 0,
    alienHp: 3,
    meteorShootable: false,
    tightAlienHitbox: false,
    hitRadius: 0.55,
    dropChance: 0.35
  },
  {
    id: 3,
    name: "HARD",
    meteorInterval: 25,
    alienChance: 2,
    alienSpeedUp: 300,
    alienHp: 3,
    meteorShootable: true,
    tightAlienHitbox: true,
    hitRadius: 0.8,
    dropChance: 0.4
  },
  {
    id: 4,
    name: "INSANE",
    meteorInterval: 16,
    alienChance: 3,
    alienSpeedUp: 150,
    alienHp: 3,
    meteorShootable: true,
    tightAlienHitbox: true,
    hitRadius: 1,
    dropChance: 0.45
  }
];

let difficulty = DIFFICULTIES[0];

// In-game HUD row. Kept below the top edge so camera cutouts and rounded
// display corners cannot cover it.
const HUD_Y = 70;
const HUD_LIVES_X = 78;
const HUD_SCORE_X = 588;
const AUTO_LABEL_Y = 114;
const DIFF_LABEL_Y = 134;

// Player life pips shown under the ship.
const SHIP_PIPS = { size: 8, gap: 21 };

// Hitboxes for menu, pause button and overlays (canvas space).
function isTouchDevice() {
  try {
    if (typeof window !== "undefined" && window.matchMedia) {
      if (window.matchMedia("(pointer: coarse)").matches ||
          window.matchMedia("(hover: none)").matches) {
        return true;
      }
    }

    if (typeof navigator !== "undefined") {
      if (/Android|iPhone|iPad|iPod|Tablet/i.test(navigator.userAgent)) {
        return true;
      }
    }
  } catch (e) {
    /* ignore */
  }

  return false;
}

const MENU_LAYOUT = {
  easy: { x: 120, y: 210, w: 360, h: 62 },
  normal: { x: 120, y: 286, w: 360, h: 62 },
  hard: { x: 120, y: 362, w: 360, h: 62 },
  insane: { x: 120, y: 438, w: 360, h: 62 },
  auto: { x: 120, y: 536, w: 360, h: 56 },
  settings: { x: 120, y: 606, w: 172, h: 56 },
  customize: { x: 308, y: 606, w: 172, h: 56 },
  getApp: { x: 120, y: 678, w: 296, h: 50 },
  github: { x: 430, y: 678, w: 50, h: 50 },
  quit: { x: 220, y: 764, w: 160, h: 46 }
};

const REPO_URL = "https://github.com/BSXRay/SpaceShooter";
const RELEASES_URL = "https://github.com/BSXRay/SpaceShooter/releases/latest";

// Opens a link outside the game. In the Android app the bridge sends
// external navigations to the system browser, so the game keeps running;
// in a browser we open a new tab.
function openExternal(url) {
  try {
    const cap = window.Capacitor;
    const native = cap && typeof cap.isNativePlatform === "function" &&
      cap.isNativePlatform();

    if (native) {
      window.location.href = url;
      return;
    }

    if (typeof window.open === "function") {
      window.open(url, "_blank", "noopener");
      return;
    }
  } catch (e) {
    /* fall through */
  }

  try {
    window.location.href = url;
  } catch (e) {
    /* nowhere to navigate to (tests) */
  }
}

// True inside the Android app. The quit button only exists there.
const IS_NATIVE_APP = (() => {
  try {
    const cap = window.Capacitor;
    return Boolean(cap && typeof cap.isNativePlatform === "function" &&
      cap.isNativePlatform());
  } catch (e) {
    return false;
  }
})();

// Closes the app through the Capacitor App plugin. That plugin is part of
// the installed APK, so the button keeps working through OTA updates.
function quitApp() {
  let app = null;

  try {
    const cap = window.Capacitor;
    app = cap && cap.Plugins ? cap.Plugins.App : null;
  } catch (e) {
    app = null;
  }

  if (!app || typeof app.exitApp !== "function") {
    return false;
  }

  try {
    const result = app.exitApp();
    if (result && typeof result.catch === "function") {
      result.catch(() => {});
    }
    return true;
  } catch (e) {
    return false;
  }
}

const DIFFICULTY_LAYOUT = [
  MENU_LAYOUT.easy,
  MENU_LAYOUT.normal,
  MENU_LAYOUT.hard,
  MENU_LAYOUT.insane
];

const PAUSE_BTN = { x: 10, y: 34, w: 60, h: 52 };
const PAUSE_RESUME_BTN = { x: 150, y: 370, w: 300, h: 65 };
const PAUSE_SETTINGS_BTN = { x: 150, y: 455, w: 300, h: 65 };
const PAUSE_MENU_BTN = { x: 150, y: 540, w: 300, h: 65 };

// Settings screen sliders (canvas space).
const SETTINGS_BACK_BTN = { x: 150, y: 640, w: 300, h: 60 };
const SETTINGS_SLIDERS = {
  musicVol: { x: 150, y: 350, w: 300, h: 12 },
  sfxVol: { x: 150, y: 470, w: 300, h: 12 }
};

// --------------------------------------------------
// SHIP CUSTOMIZATION
// --------------------------------------------------

// Hull profiles. The drawn size only changes the look; the hitbox stays
// the same, so no skin is easier or harder to fly.
const SHIP_SKINS = [
  { id: "classic", name: "CLASSIC", w: 100, h: 120 },
  { id: "bulwark", name: "BULWARK", w: 116, h: 112 },
  { id: "dart", name: "DART", w: 86, h: 128 }
];

// Normalized slider values (0..1). Hue and lightness are centered: 0.5
// keeps the original sprite untouched.
const shipStyle = {
  skin: 0,
  hue: 0.5,
  sat: 0.5,
  light: 0.5
};

const CUSTOMIZE_PREVIEW = { x: 150, y: 170, w: 300, h: 180 };

const CUSTOMIZE_SKINS = [
  { x: 120, y: 368, w: 110, h: 44 },
  { x: 245, y: 368, w: 110, h: 44 },
  { x: 370, y: 368, w: 110, h: 44 }
];

const CUSTOMIZE_SLIDERS = {
  hue: { x: 150, y: 480, w: 300, h: 12 },
  sat: { x: 150, y: 575, w: 300, h: 12 },
  light: { x: 150, y: 670, w: 300, h: 12 }
};

const CUSTOMIZE_BACK_BTN = { x: 150, y: 750, w: 300, h: 60 };

function loadShipStyle() {
  const saved = store.get("shipStyle", null);

  if (!saved || typeof saved !== "object") {
    return;
  }

  const skin = Math.round(Number(saved.skin));

  if (Number.isFinite(skin)) {
    shipStyle.skin = Math.max(0, Math.min(SHIP_SKINS.length - 1, skin));
  }

  shipStyle.hue = clamp01(saved.hue, 0.5);
  shipStyle.sat = clamp01(saved.sat, 0.5);
  shipStyle.light = clamp01(saved.light, 0.5);
}

function saveShipStyle() {
  store.set("shipStyle", {
    skin: shipStyle.skin,
    hue: shipStyle.hue,
    sat: shipStyle.sat,
    light: shipStyle.light
  });
}

// Hue rotation in degrees, plus the CSS filter that applies the whole
// style. Canvas filters recolor the sprite at draw time, so dragging the
// sliders costs nothing besides the usual frame.
function shipHueDegrees() {
  return (shipStyle.hue - 0.5) * 360;
}

function shipFilter() {
  const hue = shipHueDegrees();
  const sat = shipStyle.sat * 2;
  const light = 0.35 + shipStyle.light * 1.3;

  if (
    Math.abs(hue) < 0.5 &&
    Math.abs(sat - 1) < 0.01 &&
    Math.abs(light - 1) < 0.01
  ) {
    return "none";
  }

  return "hue-rotate(" + hue.toFixed(1) + "deg) " +
    "saturate(" + sat.toFixed(2) + ") " +
    "brightness(" + light.toFixed(2) + ")";
}

// Recomputes the position and size of every UI element for the current
// world height. The stored values are the 900 unit design positions:
// menus and overlays stay vertically centered, bottom anchored elements
// follow the lower edge. On short displays the whole interface shrinks.
function layoutUI() {
  const L = MENU_LAYOUT;
  const touch = isTouchDevice();

  // On mobile/tablet the UI must stay off the difficulty buttons. Push the
  // bottom row down and make every button a little bigger so thumbs hit.
  const diffH = touch ? 70 * uiScale : 62 * uiScale;
  const midH = touch ? 64 * uiScale : 56 * uiScale;
  const linkH = touch ? 58 * uiScale : 50 * uiScale;
  const bottomGap = touch ? 22 * uiScale : 0;

  L.easy.y = midY(210);
  L.normal.y = midY(286);
  L.hard.y = midY(362);
  L.insane.y = midY(438);
  L.auto.y = midY(536);
  L.settings.y = midY(touch ? 628 : 606);
  L.customize.y = midY(touch ? 628 : 606);
  L.getApp.y = midY(touch ? 720 : 678);

  L.easy.h = L.normal.h = L.hard.h = L.insane.h = diffH;
  L.auto.h = midH;
  L.settings.h = L.customize.h = midH;
  L.getApp.h = linkH;

  // SETTINGS and CUSTOMIZE share one row.
  if (touch) {
    L.settings.w = L.customize.w = 168 * uiScale;
    L.settings.x = 120;
    L.customize.x = 480 - L.customize.w;
    L.customize.y = L.settings.y;
  } else {
    L.settings.w = L.customize.w = 172 * uiScale;
    L.settings.x = 120;
    L.customize.x = 480 - L.customize.w;
  }

  L.github.w = L.github.h = touch ? 58 * uiScale : 50 * uiScale;
  L.github.x = 480 - L.github.w;
  L.github.y = L.getApp.y + (L.getApp.h - L.github.h) / 2;

  L.quit.y = midY(touch ? 812 : 764);
  L.quit.w = touch ? 176 * uiScale : 160 * uiScale;
  L.quit.h = touch ? 52 * uiScale : 46 * uiScale;
  L.quit.x = (W - L.quit.w) / 2;

  PAUSE_RESUME_BTN.y = midY(370);
  PAUSE_SETTINGS_BTN.y = midY(455);
  PAUSE_MENU_BTN.y = midY(540);
  PAUSE_RESUME_BTN.h = PAUSE_SETTINGS_BTN.h = PAUSE_MENU_BTN.h = 65 * uiScale;

  SETTINGS_BACK_BTN.y = midY(640);
  SETTINGS_BACK_BTN.h = 60 * uiScale;

  SETTINGS_SLIDERS.musicVol.y = midY(350);
  SETTINGS_SLIDERS.sfxVol.y = midY(470);
  SETTINGS_SLIDERS.musicVol.h = SETTINGS_SLIDERS.sfxVol.h = 12 * uiScale;

  CUSTOMIZE_PREVIEW.y = midY(170);
  CUSTOMIZE_PREVIEW.h = 180 * uiScale;

  const skinGap = 15 * uiScale;
  const skinW = 110 * uiScale;
  const skinTotal = CUSTOMIZE_SKINS.length * skinW +
    (CUSTOMIZE_SKINS.length - 1) * skinGap;
  let skinX = (W - skinTotal) / 2;

  for (const b of CUSTOMIZE_SKINS) {
    b.x = skinX;
    b.y = midY(368);
    b.w = skinW;
    b.h = 44 * uiScale;
    skinX += skinW + skinGap;
  }

  CUSTOMIZE_SLIDERS.hue.y = midY(480);
  CUSTOMIZE_SLIDERS.sat.y = midY(575);
  CUSTOMIZE_SLIDERS.light.y = midY(670);
  CUSTOMIZE_SLIDERS.hue.h = 12 * uiScale;
  CUSTOMIZE_SLIDERS.sat.h = 12 * uiScale;
  CUSTOMIZE_SLIDERS.light.h = 12 * uiScale;

  CUSTOMIZE_BACK_BTN.y = midY(750);
  CUSTOMIZE_BACK_BTN.h = 60 * uiScale;

  AWARD.BADGE_Y = midY(640);
  AWARD.SLOT_Y = H - 42;
}

let menuSettingsOpen = false;
let menuCustomizeOpen = false;
let pauseSettingsOpen = false;

const settings = {
  musicVol: 0.4,
  sfxVol: 0.8
};

// Volumes and ship style are restored once at start-up. main.js applies
// the volumes right after the first layout pass.
function saveSettings() {
  store.set("settings", {
    musicVol: settings.musicVol,
    sfxVol: settings.sfxVol
  });
}

(function loadPersistedState() {
  const saved = store.get("settings", null);

  if (saved && typeof saved === "object") {
    settings.musicVol = clamp01(saved.musicVol, 0.4);
    settings.sfxVol = clamp01(saved.sfxVol, 0.8);
  }

  loadShipStyle();
})();

function inRect(p, r) {
  return (
    p.x >= r.x && p.x <= r.x + r.w &&
    p.y >= r.y && p.y <= r.y + r.h
  );
}

function inCircle(p, r) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const dx = p.x - cx;
  const dy = p.y - cy;

  return dx * dx + dy * dy <= (r.w / 2) * (r.w / 2);
}

// Returns the horizontal value (0..1) for a slider given a point.
function sliderValue(p, slider) {
  const t = (p.x - slider.x) / slider.w;
  return Math.max(0, Math.min(1, t));
}

function sliderHit(p, slider) {
  const pad = 22;

  return inRect(p, {
    x: slider.x - pad,
    y: slider.y - pad,
    w: slider.w + pad * 2,
    h: slider.h + pad * 2
  });
}

// --------------------------------------------------
// GAME SETUP
// --------------------------------------------------

function reset() {
  lives = 5;
  score = 0;
  ticks = 0;
  meteorTimer = 0;

  ship = {
    x: 300,
    y: H - 60,
    w: 100,
    h: 120,
    hitW: 56,
    hitH: 74,
    speed: 10,
    cooldown: 0
  };

  bullets = [];
  meteors = [];
  aliens = [];
  explosions = [];
  pickups = [];
  ownedPowerups = [];
  award = null;
}

function startGame(id) {
  difficulty =
    DIFFICULTIES.find(d => d.id === id) || DIFFICULTIES[0];

  reset();
  mode = "playing";
  pauseSettingsOpen = false;

  if (musicOn) {
    startMusic();
  }
}

function endGame() {
  mode = "over";
  audio.music.pause();
}

function pauseGame() {
  if (mode !== "playing") return;

  mode = "paused";
  pauseSettingsOpen = false;
  pausedAt = now;
  pointer = null;
  audio.music.pause();
}

function resumeGame() {
  if (mode !== "paused") return;

  mode = "playing";
  pauseSettingsOpen = false;

  // Keep time-based animations (award banner) from jumping forward.
  if (award) {
    award.start += now - pausedAt;
  }

  if (musicOn) {
    sound("music");
  }
}

function toMainMenu() {
  mode = "menu";
  pointer = null;
  pauseSettingsOpen = false;
  audio.music.pause();
}

function clampShip() {
  ship.x = Math.max(50, Math.min(550, ship.x));
  ship.y = Math.max(60, Math.min(H - 60, ship.y));
}

// --------------------------------------------------
// ENEMIES AND COLLISIONS
// --------------------------------------------------

function spawnMeteor() {
  meteors.push({
    x: Math.random() * W,
    y: 10,
    w: 60,
    h: 60,
    hitW: 44,
    hitH: 44,
    speed: 3,
    shootable: difficulty.meteorShootable,
    exploding: false,
    timer: 8
  });
}

function spawnAlien() {
  const vx = Math.random() < 0.5 ? -3 : 3;

  aliens.push({
    x: Math.random() * W,
    y: 10,
    w: 80,
    h: 50,
    hitW: 62,
    hitH: 34,
    vx,
    vy: 2 + (
      difficulty.alienSpeedUp
        ? Math.floor(ticks / difficulty.alienSpeedUp)
        : 0
    ),
    hp: difficulty.alienHp,
    maxHp: difficulty.alienHp,
    exploding: false,
    timer: 8
  });
}

function explode(x, y, type) {
  explosions.push({ x, y, type, timer: 8 });
}

// Axis-aligned overlap using each object's dedicated hitbox size.
function overlap(a, b) {
  const aw = a.hitW !== undefined ? a.hitW : a.w;
  const ah = a.hitH !== undefined ? a.hitH : a.h;
  const bw = b.hitW !== undefined ? b.hitW : b.w;
  const bh = b.hitH !== undefined ? b.hitH : b.h;

  return (
    Math.abs(a.x - b.x) < (aw + bw) / 2 &&
    Math.abs(a.y - b.y) < (ah + bh) / 2
  );
}

// Elliptical hit test, used for the ship and UFOs so corner pixels
// do not count. Radii are derived from the hitbox sizes.
function ellipseHit(a, b, scale = 1) {
  const aw = (a.hitW !== undefined ? a.hitW : a.w) / 2 * scale;
  const ah = (a.hitH !== undefined ? a.hitH : a.h) / 2 * scale;
  const bw = (b.hitW !== undefined ? b.hitW : b.w) / 2 * scale;
  const bh = (b.hitH !== undefined ? b.hitH : b.h) / 2 * scale;

  const dx = (a.x - b.x) / (aw + bw);
  const dy = (a.y - b.y) / (ah + bh);

  return dx * dx + dy * dy <= 1;
}

function loseLife(n = 1) {
  lives -= n;

  if (lives <= 0) {
    lives = 0;
    endGame();
  }
}

// --------------------------------------------------
// POWER-UPS
// --------------------------------------------------

// Picks a power-up type using the weighted drop chances. A difficulty may
// override individual weights (e.g. EASY makes the common ones rarer but
// leaves Spread Shot untouched).
function rollPowerup() {
  const overrides = difficulty.powerupWeights || {};

  const weightOf = p =>
    overrides[p.key] !== undefined ? overrides[p.key] : p.weight;

  let total = 0;

  for (const p of POWERUPS) total += weightOf(p);

  let r = Math.random() * total;

  for (const p of POWERUPS) {
    r -= weightOf(p);
    if (r <= 0) return p;
  }

  return POWERUPS[0];
}

// Drops a falling power-up pickup at the given position.
function dropPowerup(x, y) {
  const type = rollPowerup();

  pickups.push({
    type,
    x,
    y,
    w: 44,
    h: 44,
    speed: 2.2,
    spin: Math.random() * Math.PI * 2
  });
}

// Adds a collected power-up's time to the owned list and starts the
// award banner. A second copy stacks another full duration on top.
function collectPowerup(powerup, fromX, fromY) {
  const existing = ownedPowerups.find(o => o.key === powerup.key);

  if (existing) {
    existing.remaining += powerup.duration;
  } else {
    ownedPowerups.push({ ...powerup, remaining: powerup.duration });
  }

  // (Re)start the medal banner animation.
  award = {
    powerup,
    phase: "in",
    start: now,
    fromX,
    fromY
  };

  sound("powerup");
}

// Returns true while the given power-up is active.
function hasPowerup(key) {
  return ownedPowerups.some(p => p.key === key);
}

// Ticks down active power-ups and removes the expired ones.
function updatePowerups(dt) {
  for (const p of ownedPowerups) {
    p.remaining -= dt;
  }

  ownedPowerups = ownedPowerups.filter(p => p.remaining > 0);
}

// Advances the award banner animation and returns the current phase.
function updateAward() {
  if (!award) return;

  const t = now - award.start;

  if (award.phase === "in") {
    if (t >= AWARD.IN_MS) {
      award.phase = "hold";
      award.start = now;
    }
  } else if (award.phase === "hold") {
    if (t >= AWARD.HOLD_MS) {
      award.phase = "out";
      award.start = now;
    }
  } else if (award.phase === "out") {
    if (t >= AWARD.OUT_MS) {
      award = null;
    }
  }
}

// --------------------------------------------------
// GAME LOGIC
// --------------------------------------------------

function update() {
  if (mode !== "playing") return;

  ticks++;

  // Movement
  if (keys.arrowleft || keys.a) ship.x -= ship.speed;
  if (keys.arrowright || keys.d) ship.x += ship.speed;
  if (keys.arrowup || keys.w) ship.y -= ship.speed;
  if (keys.arrowdown || keys.s) ship.y += ship.speed;

  clampShip();

  // Shooting
  if (ship.cooldown > 0) {
    ship.cooldown--;
  }

  if ((keys[" "] || autoShoot) && ship.cooldown === 0) {
    const spread = hasPowerup("spreadShot");
    const angles = spread ? [-0.28, -0.14, 0, 0.14, 0.28] : [0];

    for (const angle of angles) {
      const speed = 10;

      bullets.push({
        x: ship.x,
        y: ship.y - 65,
        w: 80,
        h: 60,
        hitW: 18,
        hitH: 42,
        speed,
        vx: Math.sin(angle) * speed,
        vy: -Math.cos(angle) * speed,
        angle
      });
    }

    // Rapid fire roughly halves the delay between shots.
    ship.cooldown = hasPowerup("rapidFire") ? 5 : 10;
    sound("shoot");
  }

  // Power-up timers (one update tick is 20 ms).
  updatePowerups(20);

  // Meteors
  meteorTimer++;

  if (meteorTimer >= difficulty.meteorInterval) {
    meteorTimer = 0;
    spawnMeteor();
  }

  // UFOs
  if (Math.random() * 100 < difficulty.alienChance) {
    spawnAlien();
  }

  // Projectiles
  for (const b of bullets) {
    b.x += b.vx || 0;
    b.y += b.vy !== undefined ? b.vy : -b.speed;
  }

  bullets = bullets.filter(b => b.y > -40 && b.x > -40 && b.x < W + 40);

  // Update meteors
  for (const m of meteors) {
    if (m.exploding) {
      m.timer--;
      continue;
    }

    m.y += m.speed;

    if (m.shootable) {
      const i = bullets.findIndex(b => overlap(m, b));

      if (i !== -1) {
        bullets.splice(i, 1);

        m.exploding = true;
        m.timer = 8;

        explode(m.x, m.y, "meteorExplosion");
        sound("meteorBoom");
        continue;
      }
    }

    if (ellipseHit(m, ship, 0.9)) {
      loseLife(1);
      m.remove = true;
    }

    if (m.y + 30 >= H) {
      m.remove = true;
    }
  }

  meteors = meteors.filter(
    m => !m.remove && (!m.exploding || m.timer > 0)
  );

  // Update UFOs
  for (const a of aliens) {
    if (a.exploding) {
      a.timer--;
      continue;
    }

    a.x += a.vx;
    a.y += a.vy;

    if (Math.random() < 1 / 150) {
      a.vx = -a.vx;
    }

    if (a.x < 40) a.vx = Math.abs(a.vx);
    if (a.x > 560) a.vx = -Math.abs(a.vx);

    const bi = bullets.findIndex(b =>
      difficulty.tightAlienHitbox
        ? ellipseHit(a, b, 0.8)
        : overlap(a, b)
    );

    if (bi !== -1) {
      bullets.splice(bi, 1);
      a.hp -= hasPowerup("damageBoost") ? 2 : 1;

      if (a.hp <= 0) {
        lives = Math.min(5, lives + 1);
        score++;

        a.exploding = true;
        a.timer = 8;

        explode(a.x, a.y, "alienExplosion");
        sound("alienBoom");

        if (Math.random() < difficulty.dropChance) {
          dropPowerup(a.x, a.y);
        }

        continue;
      }
    }

    const hit = difficulty.tightAlienHitbox
      ? ellipseHit(a, ship, 0.8)
      : overlap(a, ship);

    if (hit) {
      loseLife();
      score = Math.max(0, score - 1);
      a.remove = true;
    } else if (a.y + a.h / 2 >= H) {
      loseLife();
      score = Math.max(0, score - 1);
      a.remove = true;
    }
  }

  aliens = aliens.filter(
    a => !a.remove && (!a.exploding || a.timer > 0)
  );

  // Explosions
  for (const e of explosions) {
    e.timer--;
  }

  explosions = explosions.filter(e => e.timer > 0);

  // Power-up pickups
  for (const p of pickups) {
    p.y += p.speed;
    p.spin += 0.04;

    if (ellipseHit(p, ship, 1.1)) {
      collectPowerup(p.type, p.x, p.y);
      p.remove = true;
    } else if (p.y - 30 >= H) {
      p.remove = true;
    }
  }

  pickups = pickups.filter(p => !p.remove);

  updateAward();
}
