"use strict";

// --------------------------------------------------
// CANVAS AND ASSETS
// --------------------------------------------------

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

// The game world is always 600 units wide. The height adapts to the
// display aspect ratio, so the game fills the whole screen on tall
// phones instead of being letterboxed. On desktop the canvas keeps the
// classic 2:3 ratio via CSS, which yields the original 900 unit height.
const DESIGN_H = 900;

// Scale factor of the user interface. The interface is designed for a
// 900 unit tall world. On shorter displays it shrinks so that menus and
// overlays always fit on screen.
let uiScale = 1;

// Device pixels per world unit. Used to keep canvas filters (which work
// in device pixels) at a constant visual size.
let worldScale = 1;

let W = 600;
let H = DESIGN_H;

// Maps a y coordinate of the 900 unit design layout to the current world
// height. Menus and overlays stay vertically centered on any screen.
function midY(designY) {
  return H / 2 + (designY - DESIGN_H / 2) * uiScale;
}

// Sizes the canvas to the display and updates the world height.
// The canvas backing store uses device pixels; a canvas transform maps
// the world units (600 wide) onto it, so all drawing code keeps working
// in world coordinates.
function resizeGame() {
  const cssW = canvas.clientWidth || W;
  const cssH = canvas.clientHeight || (cssW * DESIGN_H) / W;
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

  H = Math.max(200, Math.round((W * cssH) / cssW));
  uiScale = Math.min(1, H / DESIGN_H);

  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);

  // Must come after the size assignment: that resets the context state.
  worldScale = canvas.width / W;
  ctx.setTransform(worldScale, 0, 0, canvas.height / H, 0, 0);

  layoutUI();

  if (ship) {
    clampShip();
  }
}

// Assets are served from the same origin as the page (fast, cached).
// When that fails (e.g. opened locally without the copied asset folders),
// we fall back to the raw GitHub host.
const ROOT = "./";
const FALLBACK_ROOT =
  "https://raw.githubusercontent.com/BSXRay/SpaceShooter/main/";

const imageNames = {
  menu: "backg2.png",
  bg: "backg.png",
  ship: "shooter.png",
  bullet: "geschoss.png",
  meteor: "meteorite.png",
  meteorExplosion: "meteorBoom.png",
  alien: "alien_1.png",
  alienExplosion: "boom.png",
  rapidFire: "RapidFire.png",
  spreadShot: "SpreadShot.png",
  damageBoost: "DamageBoost.png"
};

const imgs = {};
const imageStatus = {};

for (const [key, file] of Object.entries(imageNames)) {
  const img = new Image();

  imgs[key] = img;
  imageStatus[key] = "loading";

  img.onload = () => imageStatus[key] = "ok";
  img.onerror = () => {
    // Retry once from the fallback host before giving up.
    if (!img.dataset.fallback) {
      img.dataset.fallback = "1";
      img.src = FALLBACK_ROOT + "images/" + file;
    } else {
      imageStatus[key] = "error";
    }
  };

  img.src = ROOT + "images/" + file;
}

// --------------------------------------------------
// AUDIO
// --------------------------------------------------

const audioFiles = {
  music: "Background_music.mp3",
  shoot: "pew.mp3",
  alienBoom: "boom.mp3",
  meteorBoom: "meteorBoom.mp3",
  powerup: "powerup_schuss.mp3"
};

const audio = {};

for (const [key, file] of Object.entries(audioFiles)) {
  const a = new Audio();

  // Ask the browser to buffer the asset up front so playback can start
  // as soon as possible, instead of waiting for the first play() call.
  a.preload = "auto";
  a.src = ROOT + "sounds/" + file;

  if (key === "music") {
    a.loop = true;
    a.volume = 0.4;
  }

  audio[key] = a;
}

// Tracks which clips have enough data buffered to play smoothly.
const audioReady = {};
const audioPending = {};

for (const key of Object.keys(audioFiles)) {
  audioReady[key] = false;
  audioPending[key] = false;

  const a = audio[key];

  const markReady = () => {
    audioReady[key] = true;

    // If a play() was requested before the asset was ready, start now.
    if (audioPending[key]) {
      audioPending[key] = false;

      // Do not start music while muted or outside an active round.
      if (
        key === "music" &&
        (!musicOn || mode === "paused" || mode === "menu")
      ) {
        return;
      }

      playClip(key);
    }
  };

  a.addEventListener("loadedmetadata", markReady);
  a.addEventListener("loadeddata", markReady);
  a.addEventListener("canplay", markReady);
  a.addEventListener("canplaythrough", markReady);

  // Only mark as un-ready when it truly needs more data.
  a.addEventListener("waiting", () => { audioReady[key] = false; });

  a.addEventListener("error", () => {
    audioReady[key] = false;

    // Retry once from the fallback host (e.g. local dev without assets).
    if (!a.dataset || !a.dataset.fallback) {
      if (a.dataset) a.dataset.fallback = "1";
      audioPending[key] = false;
      a.src = FALLBACK_ROOT + "sounds/" + audioFiles[key];

      try {
        a.load();
      } catch (e) {
        // Ignore.
      }

      return;
    }

    audioPending[key] = false;
  });

  // Already cached by the browser from a previous session.
  if (a.readyState >= 2) {
    audioReady[key] = true;
  }

  try {
    a.load();
  } catch (e) {
    // Loading can be blocked; the ready events will handle the retry.
  }
}

// Some browsers never fire the ready events for large files that are
// still buffering. Poll periodically so deferred clips eventually start.
setInterval(() => {
  for (const key of Object.keys(audioFiles)) {
    if (audioPending[key] && audio[key].readyState >= 2) {
      audioPending[key] = false;

      if (
        key === "music" &&
        (!musicOn || mode === "paused" || mode === "menu")
      ) {
        continue;
      }

      playClip(key);
    }
  }
}, 300);

// Mobile browsers only allow audio after a user gesture and revoke that
// permission for elements that were never played from a gesture. Unlock
// the sound effects on the first interaction so later play() calls
// succeed. The music element is never muted here: starting a round is
// itself a gesture, so its play() call is already permitted and must
// not be disturbed by an unrelated unlock pass.
let audioUnlocked = false;

function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;

  for (const key of Object.keys(audioFiles)) {
    if (key === "music") continue;

    const a = audio[key];

    try {
      // Silently start then stop to register the gesture permission.
      a.muted = true;
      const p = a.play();

      if (p && p.then) {
        p.then(() => {
          a.pause();
          a.currentTime = 0;
          a.muted = false;
        }).catch(() => {
          a.pause();
          a.currentTime = 0;
          a.muted = false;
        });
      } else {
        a.pause();
        a.muted = false;
      }
    } catch (e) {
      a.muted = false;
    }
  }
}

for (const evt of ["pointerdown", "keydown", "touchstart"]) {
  window.addEventListener(evt, unlockAudio, { once: true, passive: true });
}

let musicOn = true;

// Applies the current music/SFX volume from `settings` to all audio.
function applyVolume() {
  audio.music.volume = settings.musicVol;

  for (const key of ["shoot", "alienBoom", "meteorBoom", "powerup"]) {
    audio[key].volume = settings.sfxVol;
  }
}

// Raw play attempt, used once a clip is buffered.
function playClip(key) {
  const a = audio[key];
  if (!a) return;

  try {
    if (key !== "music") {
      a.currentTime = 0;
    }

    const result = a.play();

    if (result) {
      result.catch(() => {});
    }
  } catch (e) {
    // Audio can be blocked by the browser.
  }
}

// Plays a clip, deferring until the asset has buffered if it has not yet.
function sound(key) {
  const a = audio[key];
  if (!a) return;

  if (!audioReady[key] && a.readyState < 2) {
    // Remember that we wanted to play this and retry once it can play.
    audioPending[key] = true;

    try {
      a.load();
    } catch (e) {
      // Ignore; ready events will retry.
    }

    return;
  }

  playClip(key);
}

// Restarts the background music from the beginning. Must be called from
// within a user gesture. It intentionally does not pause() first: a
// pause() immediately before play() in the same frame leaves some mobile
// browsers silent until the next gesture. The music is already stopped
// while in the menu, so only the reset and play are needed here.
function startMusic() {
  const a = audio.music;
  if (!a) return;

  try {
    a.currentTime = 0;
  } catch (e) {
    // Some browsers reject seeking before metadata is loaded.
  }

  sound("music");
}

function toggleMusic() {
  musicOn = !musicOn;

  if (musicOn) {
    if (mode !== "paused") {
      sound("music");
    }
  } else {
    audio.music.pause();
  }
}
