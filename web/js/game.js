"use strict";

// --------------------------------------------------
// GAME STATE
// --------------------------------------------------

let mode = "menu"; // "menu" | "playing" | "paused" | "over"
let difficulty = 0;

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

// Hitboxes for the pause button and the pause menu (canvas space).
const PAUSE_BTN = { x: 12, y: 12, w: 44, h: 40 };
const PAUSE_RESUME_BTN = { x: 150, y: 400, w: 300, h: 65 };
const PAUSE_MENU_BTN = { x: 150, y: 490, w: 300, h: 65 };

function inRect(p, r) {
  return (
    p.x >= r.x && p.x <= r.x + r.w &&
    p.y >= r.y && p.y <= r.y + r.h
  );
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
    speed: 10,
    cooldown: 0
  };

  bullets = [];
  meteors = [];
  aliens = [];
  explosions = [];
}

function startGame(d) {
  difficulty = d;

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
    speed: 3,
    shootable: difficulty === 2,
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
    vx,
    vy: 2 + (
      difficulty === 2
        ? Math.floor(ticks / 300)
        : 0
    ),
    hp: 3,
    exploding: false,
    timer: 8
  });
}

function explode(x, y, type) {
  explosions.push({ x, y, type, timer: 8 });
}

function overlap(a, b) {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 &&
    Math.abs(a.y - b.y) < (a.h + b.h) / 2
  );
}

function centerHit(a, b, rx, ry) {
  return (
    Math.abs(a.x - b.x) <= rx &&
    Math.abs(a.y - b.y) <= ry
  );
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
      speed: 10
    });

    ship.cooldown = 10;
    sound("shoot");
  }

  // Meteors
  meteorTimer++;

  if (meteorTimer >= (difficulty === 2 ? 25 : 50)) {
    meteorTimer = 0;
    spawnMeteor();
  }

  // UFOs
  if (Math.random() * 100 < (difficulty === 2 ? 2 : 1)) {
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

    if (centerHit(m, ship, 35, 45)) {
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
      overlap(a, b) &&
      (difficulty === 1 || centerHit(a, b, 45, 40))
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

    const hit = overlap(a, ship) &&
      (difficulty === 1 || centerHit(a, ship, 45, 40));

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
