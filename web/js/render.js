"use strict";

// --------------------------------------------------
// DRAWING AND ASSET FALLBACKS
// --------------------------------------------------

function drawImage(key, x, y, w, h) {
  const img = imgs[key];

  if (imageStatus[key] === "ok") {
    ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
    return true;
  }

  return false;
}

function background(key) {
  if (!drawImage(key, 300, 450, 600, 900)) {
    ctx.fillStyle = "#080e24";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#aab9df";

    for (let i = 0; i < 90; i++) {
      const x = (i * 137 + 19) % W;
      const y = (i * 251 + 31) % H;

      ctx.fillRect(x, y, 2, 2);
    }
  }
}

function fallbackShip() {
  ctx.fillStyle = "#59cfff";

  ctx.beginPath();
  ctx.moveTo(ship.x, ship.y - 50);
  ctx.lineTo(ship.x - 42, ship.y + 40);
  ctx.lineTo(ship.x, ship.y + 23);
  ctx.lineTo(ship.x + 42, ship.y + 40);
  ctx.closePath();
  ctx.fill();
}

function fallbackMeteor(x, y) {
  ctx.fillStyle = "#777b8b";
  ctx.beginPath();
  ctx.arc(x, y, 25, 0, Math.PI * 2);
  ctx.fill();
}

function fallbackAlien(x, y) {
  ctx.fillStyle = "#62edbd";
  ctx.beginPath();
  ctx.ellipse(x, y, 38, 20, 0, 0, Math.PI * 2);
  ctx.fill();
}

function fallbackExplosion(x, y) {
  ctx.fillStyle = "#ff9d40";
  ctx.beginPath();
  ctx.arc(x, y, 25, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff2a0";
  ctx.beginPath();
  ctx.arc(x, y, 11, 0, Math.PI * 2);
  ctx.fill();
}

function text(str, x, y, size = 24, align = "center") {
  ctx.fillStyle = "white";
  ctx.font = "bold " + size + "px Arial";
  ctx.textAlign = align;
  ctx.fillText(str, x, y);
}

function plainText(str, x, y, size = 16, color = "#d0d4e5") {
  ctx.fillStyle = color;
  ctx.font = size + "px Arial";
  ctx.textAlign = "center";
  ctx.fillText(str, x, y);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function button(r, active) {
  const accent = active ? "#54ffc5" : "#7fb2ff";
  const radius = 14;

  // Outer glow
  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = active ? 26 : 14;

  const grad = ctx.createLinearGradient(
    r.x, r.y, r.x, r.y + r.h
  );

  if (active) {
    grad.addColorStop(0, "#1b7d63");
    grad.addColorStop(1, "#0c4236");
  } else {
    grad.addColorStop(0, "#2b3450");
    grad.addColorStop(1, "#171d30");
  }

  ctx.fillStyle = grad;
  roundRect(r.x, r.y, r.w, r.h, radius);
  ctx.fill();
  ctx.restore();

  // Top highlight
  const shine = ctx.createLinearGradient(
    r.x, r.y, r.x, r.y + r.h * 0.5
  );
  shine.addColorStop(0, "rgba(255,255,255,.18)");
  shine.addColorStop(1, "rgba(255,255,255,0)");

  ctx.fillStyle = shine;
  roundRect(r.x + 2, r.y + 2, r.w - 4, r.h * 0.5, radius - 2);
  ctx.fill();

  // Border
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  roundRect(r.x, r.y, r.w, r.h, radius);
  ctx.stroke();
}

function dim(alpha = 0.55) {
  ctx.fillStyle = "rgba(6,9,20," + alpha + ")";
  ctx.fillRect(0, 0, W, H);
}

function blurBackdrop(px = 6) {
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.filter = "blur(" + px + "px)";
  ctx.drawImage(canvas, 0, 0, W, H);
  ctx.restore();
  ctx.filter = "none";
}

// --------------------------------------------------
// MAIN MENU WITH AUTO-SHOOT TOGGLE
// --------------------------------------------------

function drawMenu() {
  background("menu");

  // Blur the background behind the menu content.
  blurBackdrop(5);

  dim(0.25);

  if (menuSettingsOpen) {
    drawSettings();
    return;
  }

  text("SPACE SHOOTER", 300, 130, 42);

  const L = MENU_LAYOUT;

  // Difficulty buttons (EASY / NORMAL / HARD / INSANE).
  for (let i = 0; i < DIFFICULTY_LAYOUT.length; i++) {
    const r = DIFFICULTY_LAYOUT[i];
    const diff = DIFFICULTIES[i];

    button(r);
    text(diff.name, r.x + r.w / 2, r.y + r.h / 2 + 9, 24);
  }

  // Auto-shoot button
  button(L.auto, autoShoot);
  text(
    "AUTO-SHOOT: " + (autoShoot ? "ON" : "OFF"),
    L.auto.x + L.auto.w / 2,
    L.auto.y + 34,
    20
  );

  // Settings button
  button(L.settings);
  text(
    "SETTINGS",
    L.settings.x + L.settings.w / 2,
    L.settings.y + 34,
    20
  );

  if (imageStatus.menu === "error") {
    plainText(
      "Background not loaded – fallback active",
      300, 690, 14, "#ffe4a6"
    );
  }
}

// --------------------------------------------------
// SETTINGS SCREEN
// --------------------------------------------------

function slider(p, label, value) {
  // Label
  text(label, 300, p.y - 40, 22);

  // Track
  ctx.fillStyle = "rgba(10,14,28,.85)";
  roundRect(p.x, p.y, p.w, p.h, p.h / 2);
  ctx.fill();

  ctx.strokeStyle = "#3b4666";
  ctx.lineWidth = 2;
  roundRect(p.x, p.y, p.w, p.h, p.h / 2);
  ctx.stroke();

  // Filled part
  const w = Math.max(p.h, p.w * value);

  const grad = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
  grad.addColorStop(0, "#3f7bd6");
  grad.addColorStop(1, "#54ffc5");

  ctx.fillStyle = grad;
  roundRect(p.x, p.y, w, p.h, p.h / 2);
  ctx.fill();

  // Knob
  const kx = p.x + p.w * value;

  ctx.save();
  ctx.shadowColor = "#7fe6ff";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#eaf6ff";
  ctx.beginPath();
  ctx.arc(kx, p.y + p.h / 2, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "#7fb2ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(kx, p.y + p.h / 2, 15, 0, Math.PI * 2);
  ctx.stroke();

  // Value
  plainText(Math.round(value * 100) + "%", 300, p.y + 55, 18, "#c3c8dc");
}

function drawSettings() {
  text("SETTINGS", 300, 170, 44);

  slider(SETTINGS_SLIDERS.musicVol, "MUSIC VOLUME", settings.musicVol);
  slider(SETTINGS_SLIDERS.sfxVol, "SFX VOLUME", settings.sfxVol);

  button(SETTINGS_BACK_BTN);
  text(
    "BACK",
    SETTINGS_BACK_BTN.x + SETTINGS_BACK_BTN.w / 2,
    SETTINGS_BACK_BTN.y + 39,
    24
  );
}

// --------------------------------------------------
// HUD, PAUSE BUTTON AND OVERLAYS
// --------------------------------------------------

function drawHUD() {
  text("LIVES: " + lives, 70, 40, 24, "left");
  text("SCORE: " + score, 585, 40, 24, "right");

  if (autoShoot) {
    ctx.fillStyle = "#54ffc5";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText("AUTO", 300, 40);
  }
}

function drawPauseButton() {
  const b = PAUSE_BTN;
  const radius = 10;

  ctx.save();
  ctx.shadowColor = "#7fb2ff";
  ctx.shadowBlur = 12;

  const grad = ctx.createLinearGradient(
    b.x, b.y, b.x, b.y + b.h
  );
  grad.addColorStop(0, "rgba(43,52,80,.92)");
  grad.addColorStop(1, "rgba(16,23,44,.92)");

  ctx.fillStyle = grad;
  roundRect(b.x, b.y, b.w, b.h, radius);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "#a6caff";
  ctx.lineWidth = 2;
  roundRect(b.x, b.y, b.w, b.h, radius);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(b.x + 17, b.y + 13, 7, 20);
  ctx.fillRect(b.x + 28, b.y + 13, 7, 20);
}

function drawPauseOverlay() {
  blurBackdrop(8);
  dim(0.55);

  text("PAUSED", 300, 330, 46);

  button(PAUSE_RESUME_BTN);
  text("PLAY", 300, 441, 26);

  button(PAUSE_MENU_BTN);
  text("MAIN MENU", 300, 531, 26);

  plainText("Esc or Enter to resume", 300, 600, 15, "#c3c8dc");
}

function drawGameOver() {
  blurBackdrop(8);
  dim(0.55);

  text("GAME OVER", 300, 420, 46);
  text("SCORE: " + score, 300, 480, 30);
  text("Press R or click to return", 300, 540, 20);
}

// --------------------------------------------------
// GAME RENDERING
// --------------------------------------------------

function drawGame() {
  background("bg");

  // Projectiles
  for (const b of bullets) {
    if (!drawImage("bullet", b.x, b.y, b.w, b.h)) {
      ctx.fillStyle = "#ffe879";
      ctx.fillRect(b.x - 3, b.y - 15, 6, 30);
    }
  }

  // Meteors
  for (const m of meteors) {
    if (m.exploding) {
      if (!drawImage("meteorExplosion", m.x, m.y, 60, 60)) {
        fallbackExplosion(m.x, m.y);
      }
    } else if (!drawImage("meteor", m.x, m.y, 60, 60)) {
      fallbackMeteor(m.x, m.y);
    }
  }

  // UFOs
  for (const a of aliens) {
    if (a.exploding) {
      if (!drawImage("alienExplosion", a.x, a.y, 80, 80)) {
        fallbackExplosion(a.x, a.y);
      }
    } else if (!drawImage("alien", a.x, a.y, 80, 50)) {
      fallbackAlien(a.x, a.y);
    }
  }

  // Player
  if (!drawImage("ship", ship.x, ship.y, 100, 120)) {
    fallbackShip();
  }

  // Explosions
  for (const e of explosions) {
    ctx.globalAlpha = Math.max(0, e.timer / 8);
    fallbackExplosion(e.x, e.y);
    ctx.globalAlpha = 1;
  }

  drawHUD();

  if (mode !== "over") {
    drawPauseButton();
  }

  if (mode === "over") {
    drawGameOver();
  } else if (mode === "paused") {
    drawPauseOverlay();
  }
}
