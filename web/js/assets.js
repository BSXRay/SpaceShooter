"use strict";

// --------------------------------------------------
// CANVAS AND ASSETS
// --------------------------------------------------

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const W = 600;
const H = 900;

const ROOT =
  "https://raw.githubusercontent.com/BSXRay/SpaceShooter/main/";

const imageNames = {
  menu: "backg2.png",
  bg: "backg.png",
  ship: "shooter.png",
  bullet: "geschoss.png",
  meteor: "meteorite.png",
  meteorExplosion: "meteorBoom.png",
  alien: "alien_1.png",
  alienExplosion: "boom.png"
};

const imgs = {};
const imageStatus = {};

for (const [key, file] of Object.entries(imageNames)) {
  const img = new Image();

  imgs[key] = img;
  imageStatus[key] = "loading";

  img.onload = () => imageStatus[key] = "ok";
  img.onerror = () => imageStatus[key] = "error";

  img.src = ROOT + "images/" + file;
}

// --------------------------------------------------
// AUDIO
// --------------------------------------------------

const audioFiles = {
  music: "Background_music.mp3",
  shoot: "pew.mp3",
  alienBoom: "boom.mp3",
  meteorBoom: "meteorBoom.mp3"
};

const audio = {};

for (const [key, file] of Object.entries(audioFiles)) {
  const a = new Audio(ROOT + "sounds/" + file);

  if (key === "music") {
    a.loop = true;
    a.volume = 0.4;
  }

  audio[key] = a;
}

let musicOn = true;

function sound(key) {
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
