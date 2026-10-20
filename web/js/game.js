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
  pickups = [];
  ownedPowerups = [];
  award = null;
}

function startGame(id) {
  difficulty =
    DIFFICULTIES.find(d => d.id === id) || DIFFICULTIES[0];

  reset();
  mode = "playing";

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
  pausedAt = now;
  pointer = null;
  audio.music.pause();
}

function resumeGame() {
  if (mode !== "paused") return;

  mode = "playing";

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
