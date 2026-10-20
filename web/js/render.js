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

function button(r, active) {
  ctx.fillStyle = active ? "#145c49" : "#303448";
  ctx.fillRect(r.x, r.y, r.w, r.h);

  ctx.strokeStyle = active ? "#54ffc5" : "#a6caff";
  ctx.lineWidth = 3;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
}

function dim(alpha = 0.65) {
  ctx.fillStyle = "rgba(0,0,0," + alpha + ")";
  ctx.fillRect(0, 0, W, H);
}

// --------------------------------------------------
// MAIN MENU WITH AUTO-SHOOT TOGGLE
// --------------------------------------------------

function drawMenu() {
  background("menu");

  text("SPACE SHOOTER", 300, 150, 46);

  // Easy
  button({ x: 130, y: 275, w: 340, h: 65 });
  text("press 1 for EASY", 300, 316, 26);

  // Hard
  button({ x: 130, y: 350, w: 340, h: 65 });
  text("press 2 for HARD", 300, 391, 26);

  plainText(
    "TIP: in hard mode you can shoot the meteors",
    300, 445, 17, "#c3c8dc"
  );

  // Auto-shoot button
  const auto = { x: 150, y: 475, w: 300, h: 65 };
  button(auto, autoShoot);
  text("AUTO-SHOOT: " + (autoShoot ? "ON" : "OFF"), 300, 515, 22);

  plainText(
    isMobile
      ? "Tap to toggle"
      : "Click to toggle · O as shortcut",
    300, 570
  );

  plainText(
    isMobile
      ? "Touch controls enabled"
      : "WASD / Arrows · Space · P · Esc",
    300, 620, 15, "#c3c8dc"
  );

  if (imageStatus.menu === "error") {
    plainText(
      "Background not loaded – fallback active",
      300, 680, 14, "#ffe4a6"
    );
  }
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

  ctx.fillStyle = "rgba(16,23,44,.75)";
  ctx.fillRect(b.x, b.y, b.w, b.h);

  ctx.strokeStyle = "#a6caff";
  ctx.lineWidth = 2;
  ctx.strokeRect(b.x, b.y, b.w, b.h);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(b.x + 14, b.y + 11, 6, 18);
  ctx.fillRect(b.x + 24, b.y + 11, 6, 18);
}

function drawPauseOverlay() {
  dim(0.7);

  text("PAUSED", 300, 330, 46);

  button(PAUSE_RESUME_BTN);
  text("PLAY", 300, 441, 26);

  button(PAUSE_MENU_BTN);
  text("MAIN MENU", 300, 531, 26);

  plainText("Esc or Enter to resume", 300, 600, 15, "#c3c8dc");
}

function drawGameOver() {
  dim(0.65);

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
