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

let lives = 5;
let score = 0;
let ticks = 0;
let meteorTimer = 0;

let lastTime = 0;
let accumulator = 0;

// Each UFO needs this many hits to be destroyed; also shown as hearts.
const ALIEN_HP = 3;

// Difficulty presets. `meteorInterval` and `alienChance` are in update
// ticks; lower interval / higher chance means more enemies.
const DIFFICULTIES = [
  {
    id: 1,
    name: "EASY",
    meteorInterval: 50,
    alienChance: 1,
    alienSpeedUp: 0,
    meteorShootable: false,
    tightAlienHitbox: false,
    hitRadius: 0.35
  },
  {
    id: 2,
    name: "NORMAL",
    meteorInterval: 38,
    alienChance: 1.5,
    alienSpeedUp: 0,
    meteorShootable: false,
    tightAlienHitbox: false,
    hitRadius: 0.55
  },
  {
    id: 3,
    name: "HARD",
    meteorInterval: 25,
    alienChance: 2,
    alienSpeedUp: 300,
    meteorShootable: true,
    tightAlienHitbox: true,
    hitRadius: 0.8
  },
  {
    id: 4,
    name: "INSANE",
    meteorInterval: 16,
    alienChance: 3,
    alienSpeedUp: 150,
    meteorShootable: true,
    tightAlienHitbox: true,
    hitRadius: 1
  }
];

let difficulty = DIFFICULTIES[0];

// Hitboxes for menu, pause button and overlays (canvas space).
const MENU_LAYOUT = {
  easy: { x: 120, y: 210, w: 360, h: 62 },
  normal: { x: 120, y: 286, w: 360, h: 62 },
  hard: { x: 120, y: 362, w: 360, h: 62 },
  insane: { x: 120, y: 438, w: 360, h: 62 },
  auto: { x: 120, y: 536, w: 360, h: 56 },
  settings: { x: 120, y: 606, w: 360, h: 56 }
};

const DIFFICULTY_LAYOUT = [
  MENU_LAYOUT.easy,
  MENU_LAYOUT.normal,
  MENU_LAYOUT.hard,
  MENU_LAYOUT.insane
];

const PAUSE_BTN = { x: 12, y: 12, w: 52, h: 46 };
const PAUSE_RESUME_BTN = { x: 150, y: 400, w: 300, h: 65 };
const PAUSE_MENU_BTN = { x: 150, y: 490, w: 300, h: 65 };

// Settings screen sliders (canvas space).
const SETTINGS_BACK_BTN = { x: 150, y: 640, w: 300, h: 60 };
const SETTINGS_SLIDERS = {
  musicVol: { x: 150, y: 350, w: 300, h: 12 },
  sfxVol: { x: 150, y: 470, w: 300, h: 12 }
};

let menuSettingsOpen = false;

const settings = {
  musicVol: 0.4,
  sfxVol: 0.8
};

function inRect(p, r) {
  return (
    p.x >= r.x && p.x <= r.x + r.w &&
    p.y >= r.y && p.y <= r.y + r.h
  );
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
    y: 840,
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
}

function startGame(id) {
  difficulty =
    DIFFICULTIES.find(d => d.id === id) || DIFFICULTIES[0];

  reset();
  mode = "playing";

  audio.music.pause();
  audio.music.currentTime = 0;

  if (musicOn) {
    sound("music");
  }
}

function endGame() {
  mode = "over";
  audio.music.pause();
}

function pauseGame() {
  if (mode !== "playing") return;

  mode = "paused";
  pointer = null;
  audio.music.pause();
}

function resumeGame() {
  if (mode !== "paused") return;

  mode = "playing";

  if (musicOn) {
    sound("music");
  }
}

function toMainMenu() {
  mode = "menu";
  pointer = null;
  audio.music.pause();
}

function clampShip() {
  ship.x = Math.max(50, Math.min(550, ship.x));
  ship.y = Math.max(60, Math.min(840, ship.y));
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
    hp: ALIEN_HP,
    maxHp: ALIEN_HP,
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
    bullets.push({
      x: ship.x,
      y: ship.y - 65,
      w: 80,
      h: 60,
      hitW: 18,
      hitH: 42,
      speed: 10
    });

    ship.cooldown = 10;
    sound("shoot");
  }

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
    b.y -= b.speed;
  }

  bullets = bullets.filter(b => b.y > -40);

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
      a.hp--;

      if (a.hp <= 0) {
        lives = Math.min(5, lives + 1);
        score++;

        a.exploding = true;
        a.timer = 8;

        explode(a.x, a.y, "alienExplosion");
        sound("alienBoom");
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
}
