"use strict";

// --------------------------------------------------
// GAME LOOP
// --------------------------------------------------

function frame(time) {
  if (!lastTime) {
    lastTime = time;
  }

  now = time;

  accumulator += Math.min(time - lastTime, 100);
  lastTime = time;

  // 50 updates per second
  while (accumulator >= 20) {
    update();
    accumulator -= 20;
  }

  if (mode === "menu") {
    drawMenu();
  } else {
    drawGame();
  }

  requestAnimationFrame(frame);
}

resizeGame();
reset();
applyVolume();
requestAnimationFrame(frame);

// Keep the world in sync with the display size (rotation, window
// resize, browser chrome showing or hiding on mobile).
let resizeTimer = null;

function scheduleResize() {
  if (resizeTimer) return;

  resizeTimer = setTimeout(() => {
    resizeTimer = null;
    resizeGame();
  }, 100);
}

window.addEventListener("resize", scheduleResize);
window.addEventListener("orientationchange", scheduleResize);

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", scheduleResize);
}
