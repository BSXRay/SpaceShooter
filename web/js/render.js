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
  const img = imgs[key];

  if (imageStatus[key] === "ok") {
    // Cover the world without distorting the artwork: scale the source
    // up until both edges are filled and crop the overflow.
    const scale = Math.max(W / img.width, H / img.height);
    const w = img.width * scale;
    const h = img.height * scale;

    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);

    return;
  }

  ctx.fillStyle = "#080e24";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#aab9df";

  for (let i = 0; i < 90; i++) {
    const x = (i * 137 + 19) % W;
    const y = (i * 251 + 31) % H;

    ctx.fillRect(x, y, 2, 2);
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

// Fallback badge for a power-up when its texture is unavailable.
function fallbackPowerup(color, x, y, size) {
  const r = size / 2;

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "rgba(10,14,28,.8)";
  ctx.beginPath();
  ctx.arc(x, y, size * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

// Draws a power-up icon (texture or fallback), centered on (x, y).
function drawPowerupIcon(powerup, x, y, size, rotation = 0) {
  const key = powerup.image;

  if (imageStatus[key] === "ok") {
    ctx.save();
    ctx.translate(x, y);

    if (rotation) ctx.rotate(rotation);

    ctx.drawImage(imgs[key], -size / 2, -size / 2, size, size);
    ctx.restore();
    return;
  }

  fallbackPowerup(powerup.color, x, y, size);
}

// Cubic ease-in-out, used by the award banner animation.
function easeInOut(t) {
  t = Math.max(0, Math.min(1, t));
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Free pixel font: Silkscreen by Jason Kottke (SIL OFL 1.1). The monospace
// fallback keeps the canvas readable until the webfont has loaded.
const UI_FONT = "Silkscreen, monospace";

function fontPx(size) {
  return Math.max(6, Math.round(size * uiScale));
}

function text(str, x, y, size = 24, align = "center") {
  ctx.fillStyle = "white";
  ctx.font = "bold " + fontPx(size) + "px " + UI_FONT;
  ctx.textAlign = align;
  ctx.fillText(str, x, y);
}

function plainText(str, x, y, size = 16, color = "#d0d4e5") {
  ctx.fillStyle = color;
  ctx.font = fontPx(size) + "px " + UI_FONT;
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

// Pixel-art panel: a rectangle whose corners are cut as a single square
// step, so every edge stays aligned to the pixel grid.
function pixelRect(x, y, w, h, cut = 10) {
  const c = Math.max(0, Math.min(cut, w / 2, h / 2));

  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w - c, y + c);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x + c, y + h - c);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.lineTo(x + c, y + c);
  ctx.closePath();
}

function button(r, active) {
  const accent = active ? "#54ffc5" : "#7fb2ff";
  const cut = Math.max(6, Math.min(12, Math.round(r.h * 0.18)));

  // Hard drop shadow, no blur: pixel art does not glow softly.
  ctx.fillStyle = "rgba(3,5,12,.6)";
  pixelRect(r.x + 3, r.y + 7, r.w, r.h, cut);
  ctx.fill();

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
  pixelRect(r.x, r.y, r.w, r.h, cut);
  ctx.fill();

  // Blocky highlight band instead of a soft gradient shine.
  ctx.fillStyle = "rgba(255,255,255,.14)";
  pixelRect(
    r.x + 5, r.y + 5,
    r.w - 10, Math.round(r.h * 0.32),
    Math.max(3, cut - 4)
  );
  ctx.fill();

  // Chunky outline plus a dark inner line for the bevel.
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  pixelRect(r.x, r.y, r.w, r.h, cut);
  ctx.stroke();

  ctx.strokeStyle = "rgba(6,9,20,.55)";
  ctx.lineWidth = 2;
  pixelRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8, Math.max(2, cut - 4));
  ctx.stroke();
}

// Official GitHub mark (16x16 viewBox). The button panel stays pixel-art,
// but the logo itself is drawn as-is, so it keeps its smooth curves.
const GITHUB_MARK_PATH =
  "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 " +
  "0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13" +
  "-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66" +
  ".07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15" +
  "-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36" +
  ".09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 " +
  "2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 " +
  "0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z";

let githubMark = null;

function githubButton(r) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const cut = Math.max(6, Math.min(12, Math.round(r.h * 0.18)));

  // Hard shadow, matching the rectangular buttons.
  ctx.fillStyle = "rgba(3,5,12,.6)";
  pixelRect(r.x + 3, r.y + 7, r.w, r.h, cut);
  ctx.fill();

  const grad = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  grad.addColorStop(0, "#2b3450");
  grad.addColorStop(1, "#171d30");

  ctx.fillStyle = grad;
  pixelRect(r.x, r.y, r.w, r.h, cut);
  ctx.fill();

  // Blocky highlight band, same treatment as the other buttons.
  ctx.fillStyle = "rgba(255,255,255,.14)";
  pixelRect(
    r.x + 5, r.y + 5,
    r.w - 10, Math.round(r.h * 0.32),
    Math.max(3, cut - 4)
  );
  ctx.fill();

  ctx.strokeStyle = "#7fb2ff";
  ctx.lineWidth = 3;
  pixelRect(r.x, r.y, r.w, r.h, cut);
  ctx.stroke();

  ctx.strokeStyle = "rgba(6,9,20,.55)";
  ctx.lineWidth = 2;
  pixelRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8, Math.max(2, cut - 4));
  ctx.stroke();

  if (!githubMark && typeof Path2D === "function") {
    githubMark = new Path2D(GITHUB_MARK_PATH);
  }

  if (githubMark) {
    const size = r.w * 0.56;

    ctx.save();
    ctx.translate(cx - size / 2, cy - size / 2);
    ctx.scale(size / 16, size / 16);
    ctx.fillStyle = "#eaf6ff";
    ctx.fill(githubMark);
    ctx.restore();
  }
}

function dim(alpha = 0.55) {
  ctx.fillStyle = "rgba(6,9,20," + alpha + ")";
  ctx.fillRect(0, 0, W, H);
}

function blurBackdrop(px = 6) {
  ctx.save();
  ctx.globalAlpha = 0.9;
  // Canvas filters work in device pixels, so the radius has to be scaled
  // to keep the blur radius constant in world units.
  ctx.filter = "blur(" + px * worldScale + "px)";
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

  if (menuCustomizeOpen) {
    drawCustomize();
    return;
  }

  text("SPACE SHOOTER", 300, midY(130), 42);

  const L = MENU_LAYOUT;

  // Difficulty buttons (EASY / NORMAL / HARD / INSANE).
  for (let i = 0; i < DIFFICULTY_LAYOUT.length; i++) {
    const r = DIFFICULTY_LAYOUT[i];
    const diff = DIFFICULTIES[i];

    button(r);
    text(diff.name, r.x + r.w / 2, r.y + r.h / 2 + (r.h > 64 ? 14 : 9), r.h > 64 ? 26 : 24);
  }

  // Auto-shoot button
  button(L.auto, autoShoot);
  text(
    "AUTO-SHOOT: " + (autoShoot ? "ON" : "OFF"),
    L.auto.x + L.auto.w / 2,
    L.auto.y + L.auto.h / 2 + 9,
    L.auto.h > 58 ? 22 : 20
  );

  // Settings and customization share one row.
  button(L.settings);
  text(
    "SETTINGS",
    L.settings.x + L.settings.w / 2,
    L.settings.y + L.settings.h / 2 + 8,
    L.settings.h > 58 ? 20 : 18
  );

  button(L.customize);
  text(
    "CUSTOMIZE",
    L.customize.x + L.customize.w / 2,
    L.customize.y + L.customize.h / 2 + 8,
    L.customize.h > 58 ? 20 : 18
  );

  // Link to the release downloads.
  button(L.getApp);
  text(
    "GET THE ANDROID APP",
    L.getApp.x + L.getApp.w / 2,
    L.getApp.y + L.getApp.h / 2 + 6,
    L.getApp.h > 52 ? 18 : 16
  );

  // Link to the source repository.
  githubButton(L.github);

  // Closing the app only makes sense inside the Android wrapper.
  if (IS_NATIVE_APP) {
    button(L.quit);
    text("QUIT", L.quit.x + L.quit.w / 2, L.quit.y + L.quit.h / 2 + 6, L.quit.h > 48 ? 18 : 16);
  }

  if (imageStatus.menu === "error") {
    plainText(
      "Background not loaded – fallback active",
      300, midY(690), 14, "#ffe4a6"
    );
  }

  // Running web bundle version (bottom edge, for verifying pulled updates).
  if (webVersion) {
    plainText("v" + webVersion, 300, H - 16 * uiScale, 12, "#6b7186");
  }
}

// --------------------------------------------------
// SETTINGS SCREEN
// --------------------------------------------------

function slider(p, label, value, valueText) {
  // Label
  text(label, 300, p.y - 40 * uiScale, 22);

  // Track
  const cut = Math.round(p.h / 2);

  ctx.fillStyle = "rgba(10,14,28,.85)";
  pixelRect(p.x, p.y, p.w, p.h, cut);
  ctx.fill();

  ctx.strokeStyle = "#3b4666";
  ctx.lineWidth = 2;
  pixelRect(p.x, p.y, p.w, p.h, cut);
  ctx.stroke();

  // Filled part
  const w = Math.max(p.h, p.w * value);

  const grad = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
  grad.addColorStop(0, "#3f7bd6");
  grad.addColorStop(1, "#54ffc5");

  ctx.fillStyle = grad;
  pixelRect(p.x, p.y, w, p.h, cut);
  ctx.fill();

  // Knob: a square with stepped corners instead of a glowing circle.
  const kx = p.x + p.w * value;
  const ky = p.y + p.h / 2;

  ctx.fillStyle = "rgba(3,5,12,.5)";
  pixelRect(kx - 13, ky - 11, 30, 30, 7);
  ctx.fill();

  ctx.fillStyle = "#eaf6ff";
  pixelRect(kx - 15, ky - 15, 30, 30, 7);
  ctx.fill();

  ctx.strokeStyle = "#7fb2ff";
  ctx.lineWidth = 2;
  pixelRect(kx - 15, ky - 15, 30, 30, 7);
  ctx.stroke();

  // Value
  plainText(
    valueText !== undefined ? valueText : Math.round(value * 100) + "%",
    300, p.y + 62 * uiScale, 18, "#c3c8dc"
  );
}

function drawSettings() {
  text("SETTINGS", 300, midY(170), 44);

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
// CUSTOMIZATION SCREEN
// --------------------------------------------------

// Draws the player sprite with the current color filter. Returns false
// when the sprite is missing so callers can fall back to a vector ship.
function drawShipSprite(cx, cy, w, h) {
  if (imageStatus.ship !== "ok") {
    return false;
  }

  ctx.save();
  ctx.filter = shipFilter();
  ctx.drawImage(imgs.ship, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();

  return true;
}

function drawCustomize() {
  text("CUSTOMIZE", 300, midY(120), 44);

  // Preview of the ship on a dark panel.
  const pv = CUSTOMIZE_PREVIEW;

  ctx.fillStyle = "rgba(9,12,26,.82)";
  pixelRect(pv.x, pv.y, pv.w, pv.h, 14);
  ctx.fill();

  ctx.strokeStyle = "#3b4666";
  ctx.lineWidth = 3;
  pixelRect(pv.x, pv.y, pv.w, pv.h, 14);
  ctx.stroke();

  const skin = SHIP_SKINS[shipStyle.skin];

  drawShipSprite(300, pv.y + pv.h / 2, skin.w * 1.3, skin.h * 1.3);

  // Hull selection.
  for (let i = 0; i < CUSTOMIZE_SKINS.length; i++) {
    const r = CUSTOMIZE_SKINS[i];

    button(r, i === shipStyle.skin);
    text(SHIP_SKINS[i].name, r.x + r.w / 2, r.y + r.h / 2 + 5, 12);
  }

  slider(
    CUSTOMIZE_SLIDERS.hue, "HUE", shipStyle.hue,
    Math.round(shipHueDegrees()) + " deg"
  );
  slider(
    CUSTOMIZE_SLIDERS.sat, "SATURATION", shipStyle.sat,
    Math.round(shipStyle.sat * 200) + "%"
  );
  slider(
    CUSTOMIZE_SLIDERS.light, "LIGHTNESS", shipStyle.light,
    Math.round((0.35 + shipStyle.light * 1.3) * 100) + "%"
  );

  button(CUSTOMIZE_BACK_BTN);
  text(
    "BACK",
    CUSTOMIZE_BACK_BTN.x + CUSTOMIZE_BACK_BTN.w / 2,
    CUSTOMIZE_BACK_BTN.y + CUSTOMIZE_BACK_BTN.h / 2 + 8,
    24
  );
}

// --------------------------------------------------
// HUD, PAUSE BUTTON AND OVERLAYS
// --------------------------------------------------

function drawHUD() {
  text("LIVES: " + lives, HUD_LIVES_X, HUD_Y, 24, "left");
  text("KILLS: " + kills, HUD_LIVES_X, HUD_KILLS_Y, 20, "left");
  text("SCORE: " + score, HUD_SCORE_X, HUD_Y, 24, "right");

  if (autoShoot) {
    ctx.fillStyle = "#54ffc5";
    ctx.font = "bold " + fontPx(14) + "px " + UI_FONT;
    ctx.textAlign = "center";
    ctx.fillText("AUTO", 300, AUTO_LABEL_Y);
  }

  // Which difficulty the current round runs on.
  plainText("DIFFICULTY: " + difficulty.name, 300, DIFF_LABEL_Y, 13, "#54ffc5");
}

function drawPauseButton() {
  const b = PAUSE_BTN;

  ctx.fillStyle = "rgba(3,5,12,.5)";
  pixelRect(b.x + 2, b.y + 5, b.w, b.h, 8);
  ctx.fill();

  const grad = ctx.createLinearGradient(
    b.x, b.y, b.x, b.y + b.h
  );
  grad.addColorStop(0, "rgba(43,52,80,.92)");
  grad.addColorStop(1, "rgba(16,23,44,.92)");

  ctx.fillStyle = grad;
  pixelRect(b.x, b.y, b.w, b.h, 8);
  ctx.fill();

  ctx.strokeStyle = "#a6caff";
  ctx.lineWidth = 3;
  pixelRect(b.x, b.y, b.w, b.h, 8);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(b.x + 17, b.y + 14, 9, 24);
  ctx.fillRect(b.x + 34, b.y + 14, 9, 24);
}

function drawPauseOverlay() {
  blurBackdrop(8);
  dim(0.55);

  if (pauseSettingsOpen) {
    drawSettings();
    return;
  }

  text("PAUSED", 300, midY(300), 46);

  button(PAUSE_RESUME_BTN);
  text("PLAY", 300, midY(411), 26);

  button(PAUSE_SETTINGS_BTN);
  text("SETTINGS", 300, midY(496), 26);

  button(PAUSE_MENU_BTN);
  text("MAIN MENU", 300, midY(581), 26);

  plainText("Esc or Enter to resume", 300, midY(650), 15, "#c3c8dc");
}

function drawGameOver() {
  blurBackdrop(8);
  dim(0.55);

  text("GAME OVER", 300, midY(400), 46);
  text("SCORE: " + gameOverStats.score, 300, midY(470), 30);
  text("KILLS: " + gameOverStats.kills, 300, midY(520), 30);
  text("Press R or click to return", 300, midY(590), 20);
}

function drawHearts(x, y, hp, maxHp, opts = {}) {
  const size = opts.size || 5;
  const gap = opts.gap || 13;
  const on = opts.on || "#ff2b2b";
  const off = opts.off || "#4a4a4a";
  const edgeOn = opts.edgeOn || "#7a0000";
  const edgeOff = opts.edgeOff || "#262626";
  const total = maxHp * gap - (gap - size * 2);
  let cx = x - total / 2 + size;

  for (let i = 0; i < maxHp; i++) {
    ctx.beginPath();
    ctx.arc(cx, y, size, 0, Math.PI * 2);
    ctx.fillStyle = i < hp ? on : off;
    ctx.fill();

    ctx.lineWidth = Math.max(1.5, size * 0.25);
    ctx.strokeStyle = i < hp ? edgeOn : edgeOff;
    ctx.stroke();

    cx += gap;
  }
}

// --------------------------------------------------
// POWER-UP RENDERING
// --------------------------------------------------

// Floating pickups drifting down the play field.
function drawPickups() {
  for (const p of pickups) {
    const bob = Math.sin(now / 220 + p.spin) * 3;

    ctx.save();
    ctx.shadowColor = p.type.color;
    ctx.shadowBlur = 14;

    drawPowerupIcon(p.type, p.x, p.y + bob, p.w, p.spin * 0.35);

    ctx.restore();
  }
}

// Collected power-ups, listed bottom-left as a small stack.
function drawOwnedPowerups() {
  const size = 34;
  const gap = 42;
  let y = AWARD.SLOT_Y;

  for (const p of ownedPowerups) {
    const x = AWARD.SLOT_X;
    const r = size / 2 + 6;

    // Dark rounded plate behind the icon.
    ctx.fillStyle = "rgba(10,14,28,.55)";
    roundRect(x - size / 2 - 4, y - size / 2 - 4, size + 8, size + 8, 9);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = 1.5;
    roundRect(x - size / 2 - 4, y - size / 2 - 4, size + 8, size + 8, 9);
    ctx.stroke();

    drawPowerupIcon(p, x, y, size);

    // Circular countdown: a ring that runs down as time is left.
    const ratio = Math.max(0, Math.min(1, p.remaining / p.duration));
    const start = -Math.PI / 2;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,.15)";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, r, start, start + Math.PI * 2 * ratio);
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineCap = "butt";

    // Remaining seconds, centered under the icon.
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold " + fontPx(11) + "px " + UI_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(Math.ceil(p.remaining / 1000), x, y + r + 9);
    ctx.textBaseline = "alphabetic";

    y -= gap + 14;
  }
}

// The blurred medal banner shown when a new power-up is collected.
function drawAward() {
  if (!award) return;

  const p = award.powerup;
  const badgeW = 260;
  const badgeH = 58;
  const badgeX = (W - badgeW) / 2;
  const badgeY = AWARD.BADGE_Y - badgeH / 2;

  let badgeAlpha = 1;
  let iconX;
  let iconY;
  let iconScale = 1;

  const restX = W / 2 - 78;

  if (award.phase === "in") {
    const t = easeInOut((now - award.start) / AWARD.IN_MS);

    badgeAlpha = t;
    iconX = award.fromX + (restX - award.fromX) * t;
    iconY = award.fromY + (AWARD.BADGE_Y - award.fromY) * t;
    iconScale = 1.4 + (1 - t) * 0.6;
  } else if (award.phase === "hold") {
    badgeAlpha = 1;
    iconX = restX;
    iconY = AWARD.BADGE_Y;
  } else {
    const t = easeInOut((now - award.start) / AWARD.OUT_MS);

    badgeAlpha = 1 - t;
    iconX = restX + (AWARD.SLOT_X - restX) * t;
    iconY = AWARD.BADGE_Y + (AWARD.SLOT_Y - AWARD.BADGE_Y) * t;
    iconScale = 1 - 0.4 * t;
  }

  // Frosted-glass backdrop behind the badge (medal plate):
  // blur the scene, then lay a translucent plate on top.
  ctx.save();
  ctx.globalAlpha = badgeAlpha;

  const plate = { x: badgeX - 10, y: badgeY - 8, w: badgeW + 20, h: badgeH + 16 };
  const plateR = plate.h / 2;

  roundRect(plate.x, plate.y, plate.w, plate.h, plateR);
  ctx.clip();

  ctx.filter = "blur(6px)";
  ctx.drawImage(canvas, 0, 0, W, H);
  ctx.filter = "none";

  ctx.fillStyle = "rgba(10,14,28,.55)";
  roundRect(plate.x, plate.y, plate.w, plate.h, plateR);
  ctx.fill();
  ctx.restore();

  // Plate border.
  ctx.save();
  ctx.globalAlpha = badgeAlpha * 0.95;
  ctx.strokeStyle = p.color;
  ctx.lineWidth = 2;
  roundRect(badgeX, badgeY, badgeW, badgeH, badgeH / 2);
  ctx.stroke();
  ctx.restore();

  // Label text (fades with the badge).
  ctx.save();
  ctx.globalAlpha = badgeAlpha;
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold " + fontPx(17) + "px " + UI_FONT;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(p.name, W / 2 - 44, AWARD.BADGE_Y + 1);
  ctx.restore();

  // The flying icon, drawn last so it sits above the badge.
  if (award.phase !== "out" || badgeAlpha > 0) {
    drawPowerupIcon(p, iconX, iconY, 40 * iconScale);
  }
}

// --------------------------------------------------
// GAME RENDERING
// --------------------------------------------------

function drawGame() {
  background("bg");

  // Projectiles
  for (const b of bullets) {
    if (b.angle) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      if (!drawImage("bullet", 0, 0, b.w, b.h)) {
        ctx.fillStyle = "#ffe879";
        ctx.fillRect(-3, -15, 6, 30);
      }
      ctx.restore();
    } else if (!drawImage("bullet", b.x, b.y, b.w, b.h)) {
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
    } else {
      if (!drawImage("alien", a.x, a.y, 80, 50)) {
        fallbackAlien(a.x, a.y);
      }

      drawHearts(a.x, a.y - 38, a.hp, a.maxHp);
    }
  }

  // Player
  const skin = SHIP_SKINS[shipStyle.skin];

  if (!drawShipSprite(ship.x, ship.y, skin.w, skin.h)) {
    fallbackShip();
  }

  // Remaining lives as pips under the ship, clamped to stay on screen.
  drawHearts(
    ship.x,
    Math.min(ship.y + 74, H - 12),
    lives,
    5,
    {
      size: SHIP_PIPS.size,
      gap: SHIP_PIPS.gap,
      on: "#54ffc5",
      off: "#3b4666",
      edgeOn: "#0b3f33",
      edgeOff: "#1c2338"
    }
  );

  // Power-up pickups
  drawPickups();

  // Explosions
  for (const e of explosions) {
    ctx.globalAlpha = Math.max(0, e.timer / 8);
    fallbackExplosion(e.x, e.y);
    ctx.globalAlpha = 1;
  }

  drawHUD();

  // Owned power-ups (bottom-left) and the award banner.
  drawOwnedPowerups();
  drawAward();

  if (mode !== "over") {
    drawPauseButton();
  }

  if (mode === "over") {
    drawGameOver();
  } else if (mode === "paused") {
    drawPauseOverlay();
  }
}
